// Form + table config per backend collection. Crud.jsx renders these.
import { today } from './api.js';

// Properties rented per bed/person, so we track total capacity.
const SHARED = ['Boarding house', 'Dormitory'];
const renewal = ['pending', 'offered', 'renewing', 'renewed', 'not renewing'];

export const resources = {
  properties: {
    title: 'Properties', singular: 'property',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'address', label: 'Address' },
      { key: 'type', label: 'Type', options: ['Boarding house', 'Dormitory', 'Apartment', 'Condominium', 'House'], required: true },
      { key: 'capacity', label: 'Total capacity (persons)', type: 'number', min: 1, step: 1, required: true, showIf: (v) => SHARED.includes(v.type) },
    ],
  },
  units: {
    title: 'Units & rooms', singular: 'unit',
    fields: [
      { key: 'propertyId', label: 'Property', ref: 'properties', required: true },
      { key: 'name', label: 'Unit / room', required: true },
      { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
      { key: 'marketRent', label: 'Market rent', type: 'number', money: true },
    ],
  },
  tenants: {
    title: 'Tenants', singular: 'tenant',
    fields: [
      { key: 'name', label: 'Full name', required: true },
      { key: 'propertyId', label: 'Renting at', ref: 'properties', required: true, hint: 'Not listed? Add the property first.' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'emergencyName', label: 'Emergency contact' },
      { key: 'emergencyPhone', label: 'Emergency phone', type: 'tel' },
      { key: 'notes', label: 'Notes', type: 'textarea', hideInTable: true },
      { key: 'archived', label: 'Archived', type: 'checkbox', hideInTable: true },
    ],
  },
  leases: {
    title: 'Leases', singular: 'lease',
    fields: [
      { key: 'tenantId', label: 'Tenant', ref: 'tenants', required: true },
      { key: 'unitId', label: 'Unit', ref: 'units', required: true },
      { key: 'startDate', label: 'Start', type: 'date', required: true, default: today },
      { key: 'endDate', label: 'End', type: 'date', required: true },
      { key: 'rent', label: 'Monthly rent', type: 'number', money: true, required: true },
      { key: 'dueDay', label: 'Rent due day', type: 'number', default: () => 1, hint: '1–28' },
      { key: 'deposit', label: 'Security deposit', type: 'number', money: true, hideInTable: true },
      { key: 'escalationPct', label: 'Escalation %', type: 'number', hideInTable: true, default: () => 0 },
      { key: 'escalationEveryMonths', label: 'Escalate every (months)', type: 'number', hideInTable: true, default: () => 12 },
      { key: 'noticeDays', label: 'Notice period (days)', type: 'number', hideInTable: true, default: () => 30 },
      { key: 'renewalStatus', label: 'Renewal', options: renewal, default: () => 'pending' },
      { key: 'moveInDate', label: 'Move-in date', type: 'date', hideInTable: true },
      { key: 'moveOutDate', label: 'Move-out date', type: 'date', hideInTable: true },
      { key: 'terminated', label: 'Terminated early', type: 'checkbox', hideInTable: true },
      { key: 'moveInChecklist', label: 'Move-in checklist', type: 'textarea', hideInTable: true, hint: 'Keys, meter readings, condition' },
      { key: 'moveOutChecklist', label: 'Move-out checklist', type: 'textarea', hideInTable: true },
    ],
  },
  payments: {
    title: 'Payments', singular: 'payment',
    fields: [
      { key: 'leaseId', label: 'Lease', ref: 'leases', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true, default: today },
      { key: 'amount', label: 'Amount', type: 'number', money: true, required: true },
      { key: 'type', label: 'Type', options: ['rent', 'deposit', 'deposit refund', 'other'], required: true, default: () => 'rent' },
      { key: 'method', label: 'Method', options: ['cash', 'GCash', 'Maya', 'bank transfer', 'check', 'card'], default: () => 'cash' },
      { key: 'reference', label: 'Reference no.' },
      { key: 'note', label: 'Note', type: 'textarea', hideInTable: true },
    ],
  },
  invoices: {
    title: 'Invoices', singular: 'invoice',
    fields: [
      { key: 'leaseId', label: 'Lease', ref: 'leases', required: true },
      { key: 'period', label: 'Period', type: 'month', default: () => today().slice(0, 7) },
      { key: 'dueDate', label: 'Due', type: 'date', required: true, default: today },
      { key: 'amount', label: 'Amount', type: 'number', money: true, required: true },
      { key: 'description', label: 'Description', default: () => 'Rent' },
    ],
  },
  expenses: {
    title: 'Expenses', singular: 'expense',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, default: today },
      { key: 'propertyId', label: 'Property', ref: 'properties' },
      { key: 'category', label: 'Category', options: ['Repairs', 'Maintenance', 'Utilities', 'Insurance', 'Taxes', 'Cleaning', 'Management', 'Mortgage', 'Other'], required: true },
      { key: 'amount', label: 'Amount', type: 'number', money: true, required: true },
      { key: 'vendor', label: 'Vendor' },
      { key: 'note', label: 'Note', type: 'textarea', hideInTable: true },
    ],
  },
  violations: {
    title: 'Lease violations', singular: 'violation',
    fields: [
      { key: 'leaseId', label: 'Lease', ref: 'leases', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true, default: today },
      { key: 'description', label: 'What happened', type: 'textarea', required: true },
      { key: 'severity', label: 'Severity', options: ['minor', 'major', 'critical'], default: () => 'minor' },
      { key: 'resolved', label: 'Resolved', type: 'checkbox' },
    ],
  },
};
