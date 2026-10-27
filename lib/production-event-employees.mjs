const key = value => String(value || '').trim().toUpperCase();
export function eventEmployees(event, directory = []) {
  const people = new Map(directory.map(person => [key(person.id), person]));
  const saved = new Map((event.employeeDetails || []).map(person => [key(person.id), person]));
  return [...new Set((event.employees || []).map(key).filter(Boolean))].map(id => ({id, name: (people.get(id)?.sourceEmployeeId ? people.get(id)?.name : saved.get(id)?.name) || people.get(id)?.name || ''}));
}
