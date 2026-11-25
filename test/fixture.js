export const trip = () => ({
  name: 'Aarav Mehta', passport: 'A1234567', city: 'Pune', state: 'Maharashtra',
  passportIssue: '2020-01-10', passportExpiry: '2030-01-10', blank: '3',
  entry: '2027-04-02', exit: '2027-04-08', application: '2027-03-03',
  firstEntry: 'France', consulate: 'France', purpose: 'tourism',
  history: 'none', priorVisa: 'no', employment: 'Salaried', funds: 'Self-funded',
  outDate: '2027-04-02', outAirport: 'CDG', returnDate: '2027-04-08', returnAirport: 'FCO',
  coverage: '30000', currency: 'EUR', insFrom: '2027-04-02', insTo: '2027-04-08', wide: 'yes',
  segments: [
    { country: 'France', city: 'Paris', from: '2027-04-02', to: '2027-04-06', nights: '4' },
    { country: 'Italy', city: 'Rome', from: '2027-04-06', to: '2027-04-08', nights: '2' },
  ],
  hotels: [
    { city: 'Paris', from: '2027-04-02', to: '2027-04-06' },
    { city: 'Rome', from: '2027-04-06', to: '2027-04-08' },
  ],
  documents: { photos: true },
});
