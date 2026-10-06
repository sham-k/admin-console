import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from './Icon'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

interface SelectProps<T extends string> {
  /** Goes on the trigger button, so `<label htmlFor={id}>` opens the list. */
  id: string
  /** Id of the visible label, used as the accessible name. */
  labelId: string
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
}

/**
 * Styled replacement for a native <select>, whose popup can't be styled and
 * renders tiny or misplaced in some browsers and embedded previews. Follows
 * the WAI-ARIA "select-only combobox" pattern: Enter/Space/arrows open the
 * list, arrows/Home/End move, Enter/Space pick, Escape/Tab close, and typing
 * a letter jumps to the next matching option.
 */
export function Select<T extends string>({ id, labelId, value, options, onChange }: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listId = `${id}-list`
  const optionId = (index: number) => `${id}-opt-${index}`

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Keep the highlighted option scrolled into view inside the list.
  useEffect(() => {
    if (open) document.getElementById(`${id}-opt-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active, id])

  const openList = (index = selectedIndex) => {
    setActive(index)
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  const pick = (index: number) => {
    const option = options[index]
    if (option && option.value !== value) onChange(option.value)
    close()
  }

  const typeahead = (key: string) => {
    if (key.length !== 1 || !/\S/.test(key)) return false
    const start = open ? active : selectedIndex
    for (let step = 1; step <= options.length; step++) {
      const index = (start + step) % options.length
      if (options[index].label.toLowerCase().startsWith(key.toLowerCase())) {
        if (open) setActive(index)
        else openList(index)
        return true
      }
    }
    return false
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const last = options.length - 1
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openList()
      } else if (typeahead(event.key)) {
        event.preventDefault()
      }
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive((i) => Math.min(i + 1, last))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(last)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        pick(active)
        break
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        if (typeahead(event.key)) event.preventDefault()
    }
  }

  return (
    <div className="custom-select" ref={rootRef}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        className="select custom-select__button"
        aria-labelledby={`${labelId} ${id}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        {options[selectedIndex]?.label}
      </button>
      <ul id={listId} role="listbox" aria-labelledby={labelId} className="custom-select__list" hidden={!open}>
        {options.map((option, index) => (
          <li
            key={option.value}
            id={optionId(index)}
            role="option"
            aria-selected={index === selectedIndex}
            className={`custom-select__option${index === active ? ' is-active' : ''}`}
            onPointerEnter={() => setActive(index)}
            // Keep focus on the button so keyboard handling stays in one place.
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => pick(index)}
          >
            <span>{option.label}</span>
            {index === selectedIndex && <Icon name="check" size={16} />}
          </li>
        ))}
      </ul>
    </div>
  )
}
