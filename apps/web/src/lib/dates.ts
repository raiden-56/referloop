import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

export const fromNow = (iso: string | Date) => dayjs(iso).fromNow();
export const formatDate = (iso: string | Date) => dayjs(iso).format('D MMM YYYY');
export const formatDateTime = (iso: string | Date) => dayjs(iso).format('D MMM YYYY, HH:mm');
/** Parses a date-only string (YYYY-MM-DD) without shifting it into the local time zone. */
export const formatDateOnly = (value: string) => dayjs(value, 'YYYY-MM-DD').format('D MMM YYYY');
export { dayjs };
