// Marking rent paid, shared by the Rent tracker and the tenant sheet: one request, one Undo.
import { api, today } from './api.js';
import { toast } from './components/Toasts.jsx';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Oct", or "Oct 2025" when it isn't this year.
export const monthName = ({ year, month }) => `${MONTHS[month - 1]}${year === Number(today().slice(0, 4)) ? '' : ` ${year}`}`;

// Digits only, for tel: and sms: links.
export const tel = (phone) => phone.replace(/[^\d+]/g, '');

const put = (tenant, months, paid) => api(`/rent/${tenant.id}`, { method: 'PUT', body: { months, paid } });

// months = [{ year, month }]. reload() refreshes whatever screen is showing.
export async function payMonths(tenant, months, reload) {
  try {
    await put(tenant, months, true);
    await reload();
    toast({ text: `${tenant.name} · ${months.length === 1 ? monthName(months[0]) : `${months.length} months`} paid`, action: 'Undo', onAction: () => unpayMonths(tenant, months, reload) });
  } catch {
    toast({ text: `Couldn't save ${tenant.name}'s payment.`, action: 'Try again', onAction: () => payMonths(tenant, months, reload), error: true });
  }
}

async function unpayMonths(tenant, months, reload) {
  try {
    await put(tenant, months, false);
    await reload();
  } catch {
    toast({ text: `Couldn't undo ${tenant.name}'s payment.`, action: 'Try again', onAction: () => unpayMonths(tenant, months, reload), error: true });
  }
}
