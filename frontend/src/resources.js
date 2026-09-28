// Form config per backend collection. Crud.jsx renders these.
import { today } from './api.js';

// Properties rented per bed/person, so we track total capacity.
const SHARED = ['Boarding house', 'Dormitory'];

export const resources = {
  properties: {
    singular: 'property',
    fields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Casa Luna Dormitory' },
      { key: 'type', label: 'Type', options: ['Boarding house', 'Dormitory', 'Apartment', 'Condominium', 'House'], chips: true, required: true },
      { key: 'capacity', label: 'Total capacity (persons)', type: 'number', min: 1, step: 1, required: true, placeholder: 'e.g. 12', hint: 'Used for "Beds occupied" on Home.', showIf: (v) => SHARED.includes(v.type) },
    ],
  },
  tenants: {
    singular: 'tenant',
    fields: [
      { key: 'name', label: 'Full name', required: true },
      { key: 'propertyId', label: 'Renting at', ref: 'properties', required: true, hint: 'Not listed? Add the property first.' },
      { key: 'monthlyRent', label: 'Monthly rent', money: true, placeholder: 'e.g. 3500' },
      { key: 'moveInDate', label: 'Move-in date', type: 'date', default: today, hint: 'Rent is due from this month' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'emergencyName', label: 'Emergency contact' },
      { key: 'emergencyPhone', label: 'Emergency phone', type: 'tel' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'archived', label: 'Archived (moved out)', type: 'checkbox' },
    ],
  },
};
