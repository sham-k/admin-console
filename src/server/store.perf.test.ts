import { UserStore } from './store'

// Guards the scale requirement: at 500k rows, paging must stay O(page size)
// and the one-off filter/sort scan must stay inside an interactive budget.
test('store stays responsive at 500k rows', () => {
  const store = new UserStore(500_000)
  const time = (fn: () => void) => {
    const start = performance.now()
    fn()
    return performance.now() - start
  }

  expect(store.total).toBe(500_000)
  const coldSort = time(() => store.list({ skip: 0, limit: 25, sort: 'name' }))
  const warmDeepPage = time(() => store.list({ skip: 499_975, limit: 25, sort: 'name' }))

  expect(coldSort).toBeLessThan(2_000)
  expect(warmDeepPage).toBeLessThan(20)
})
