// Name pools for deterministic fake data. Kept under 256 entries each so a
// seed record's name can be stored as a single byte index.
// prettier-ignore
export const FIRST_NAMES = [
  'Aaliyah', 'Aarav', 'Abigail', 'Adebayo', 'Aditi', 'Ahmed', 'Aiko', 'Alejandro', 'Amara', 'Amelia',
  'Ana', 'Andrei', 'Anika', 'Arjun', 'Astrid', 'Ava', 'Benjamin', 'Bianca', 'Carlos', 'Chen',
  'Chiara', 'Chloe', 'Daniel', 'Dante', 'Deepika', 'Diego', 'Dmitri', 'Elena', 'Elijah', 'Emeka',
  'Emily', 'Emma', 'Ethan', 'Fatima', 'Felix', 'Freya', 'Gabriel', 'Grace', 'Hana', 'Hannah',
  'Harper', 'Hassan', 'Ines', 'Isabella', 'Isaac', 'Ivan', 'Jamal', 'James', 'Javier', 'Jin',
  'Jonas', 'Jordan', 'Julia', 'Kai', 'Kavya', 'Kenji', 'Khadija', 'Kofi', 'Lars', 'Layla',
  'Leah', 'Leila', 'Leo', 'Liam', 'Lina', 'Lucas', 'Lucia', 'Luis', 'Maya', 'Malik',
  'Marco', 'Maria', 'Mateo', 'Mei', 'Mia', 'Mohammed', 'Nadia', 'Naomi', 'Nia', 'Nikhil',
  'Noah', 'Nora', 'Oliver', 'Olivia', 'Omar', 'Oscar', 'Priya', 'Rafael', 'Rania', 'Ravi',
  'Rhea', 'Riley', 'Rosa', 'Ryo', 'Sakura', 'Samuel', 'Santiago', 'Sara', 'Sebastian', 'Sofia',
  'Soren', 'Tariq', 'Thandiwe', 'Theo', 'Tomas', 'Valentina', 'Wei', 'William', 'Yara', 'Yusuf',
  'Zainab', 'Zara', 'Zoe',
  'Adrian', 'Aisha', 'Akira', 'Alice', 'Amir', 'Anders', 'Andrea', 'Anna', 'Antonio', 'Ayesha',
  'Beatriz', 'Bruno', 'Caleb', 'Camila', 'Caroline', 'Catalina', 'Charlotte', 'Chidi', 'Claire', 'Connor',
  'David', 'Elif', 'Eliza', 'Erik', 'Esther', 'Farah', 'Fernando', 'Fiona', 'Francesca', 'George',
  'Hamza', 'Haruto', 'Helena', 'Hugo', 'Imani', 'Ingrid', 'Ishaan', 'Jack', 'Jasmine', 'Joao',
  'Joseph', 'Joshua', 'Juan', 'Kamal', 'Karim', 'Katarina', 'Kate', 'Kwame', 'Laura', 'Lena',
  'Lily', 'Lorenzo', 'Luca', 'Lukas', 'Madison', 'Magnus', 'Mariam', 'Matteo', 'Max', 'Michael',
  'Miguel', 'Mina', 'Nathan', 'Neha', 'Nikolai', 'Nina', 'Paolo', 'Patrick', 'Paula', 'Pedro',
  'Rachel', 'Rahul', 'Ren', 'Rohan', 'Ruby', 'Ruth', 'Salma', 'Sam', 'Sanjay', 'Selin',
  'Simon', 'Siddharth', 'Sophie', 'Stella', 'Tanvi', 'Thomas', 'Tobias', 'Uma', 'Victor', 'Vikram',
  'Yuki', 'Yuna', 'Zeynep', 'Ziad',
]

// prettier-ignore
export const LAST_NAMES = [
  'Abara', 'Adeyemi', 'Ahmed', 'Alvarez', 'Andersen', 'Bakker', 'Banerjee', 'Becker', 'Bianchi', 'Brown',
  'Campbell', 'Castillo', 'Chen', 'Cohen', 'Costa', 'Dang', 'Davis', 'Delgado', 'Diaz', 'Dubois',
  'Eriksson', 'Evans', 'Fernandez', 'Fischer', 'Garcia', 'Gonzalez', 'Gupta', 'Haddad', 'Hansen', 'Hernandez',
  'Hoang', 'Hughes', 'Ibrahim', 'Ito', 'Jackson', 'Jensen', 'Johnson', 'Kaur', 'Kelly', 'Khan',
  'Kim', 'Kowalski', 'Kumar', 'Larsen', 'Lee', 'Lopez', 'Martin', 'Martinez', 'Mensah', 'Meyer',
  'Miller', 'Moreau', 'Murphy', 'Nakamura', 'Nguyen', 'Novak', 'Nowak', 'Okafor', 'Okeke', 'Oliveira',
  'Ortiz', 'Owusu', 'Park', 'Patel', 'Perez', 'Petrov', 'Popescu', 'Quinn', 'Ramirez', 'Rao',
  'Reyes', 'Rivera', 'Robinson', 'Rossi', 'Russo', 'Sato', 'Schmidt', 'Shah', 'Silva', 'Singh',
  'Smith', 'Sokolov', 'Suzuki', 'Tanaka', 'Taylor', 'Thomas', 'Torres', 'Tran', 'Van Dijk', 'Vargas',
  'Walker', 'Wang', 'Williams', 'Wilson', 'Wong', 'Yamamoto', 'Yilmaz', 'Young', 'Zhang', 'Zhou',
  'Abbott', 'Acheampong', 'Agarwal', 'Aguilar', 'Allen', 'Almeida', 'Arslan', 'Bailey', 'Barnes', 'Bauer',
  'Bennett', 'Bhatt', 'Brooks', 'Carter', 'Chandra', 'Clarke', 'Coleman', 'Collins', 'Cruz', 'Das',
  'Dimitrov', 'Edwards', 'Esposito', 'Farouk', 'Ferrari', 'Foster', 'Fujita', 'Gomes', 'Graham', 'Gray',
  'Greco', 'Hall', 'Harris', 'Hayes', 'Herrera', 'Hill', 'Horvat', 'Hussain', 'Iyer', 'Jovanovic',
  'Kang', 'Keller', 'Kennedy', 'Kovacs', 'Kruger', 'Lambert', 'Lin', 'Liu', 'Lombardi', 'Mahmoud',
  'Malik', 'Marsh', 'Mehta', 'Mendes', 'Mitchell', 'Molina', 'Morales', 'Morris', 'Moyo', 'Mukherjee',
  'Nair', 'Nielsen', 'Nkosi', 'Obi', 'Ozturk', 'Pereira', 'Phillips', 'Pillai', 'Reed', 'Reid',
  'Richter', 'Romero', 'Ross', 'Saito', 'Sanchez', 'Santos', 'Sharma', 'Sullivan', 'Svensson', 'Takahashi',
  'Turner', 'Vasquez', 'Vogel', 'Ward', 'Watanabe', 'Weber', 'White', 'Wright', 'Yadav', 'Zimmerman',
]

// Microsoft's documented fictitious company names: realistic-looking, but
// reserved for samples, so no real person's address is ever generated.
// prettier-ignore
export const DOMAINS = [
  'contoso.com', 'fabrikam.com', 'northwindtraders.com', 'adventure-works.com', 'tailspintoys.com',
  'wingtiptoys.com', 'woodgrovebank.com', 'litwareinc.com', 'proseware.com', 'fourthcoffee.com',
  'wideworldimporters.com', 'alpineskihouse.com', 'cohowinery.com', 'lucernepublishing.com',
  'treyresearch.net', 'adatum.com',
]

/** Lowercase, letters-only form of a name for email addresses ("Van Dijk" -> "vandijk"). */
export function emailSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '')
}

/** Small, fast, seedable PRNG so every reload produces the same data set. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
