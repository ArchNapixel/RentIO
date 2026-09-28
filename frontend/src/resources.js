// Form + table config per backend collection. Crud.jsx renders these.
import { today } from './api.js';

// Properties rented per bed/person, so we track total capacity.
const SHARED = ['Boarding house', 'Dormitory'];

export const resources = {
  properties: {
    title: 'Properties', singular: 'property',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'type', label: 'Type', options: ['Boarding house', 'Dormitory', 'Apartment', 'Condominium', 'House'], required: true },
      { key: 'capacity', label: 'Total capacity (persons)', type: 'number', min: 1, step: 1, required: true, showIf: (v) => SHARED.includes(v.type) },
    ],
  },
  tenants: {
    title: 'Tenants', singular: 'tenant',
    fields: [
      { key: 'name', label: 'Full name', required: true },
      { key: 'propertyId', label: 'Renting at', ref: 'properties', required: true, hint: 'Not listed? Add the property first.' },
      { key: 'monthlyRent', label: 'Monthly rent', type: 'number', min: 0, money: true },
      { key: 'moveInDate', label: 'Move-in date', type: 'date', default: today, hint: 'Rent is due from this month' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'emergencyName', label: 'Emergency contact' },
      { key: 'emergencyPhone', label: 'Emergency phone', type: 'tel' },
      { key: 'notes', label: 'Notes', type: 'textarea', hideInTable: true },
      { key: 'archived', label: 'Archived (moved out)', type: 'checkbox', hideInTable: true },
    ],
  },
};
