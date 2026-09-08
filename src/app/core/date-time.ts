import dayjs, { ConfigType } from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/pt-br';

dayjs.extend(localizedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('pt-br');

export const dateTime = {
  display(value: ConfigType): string {
    return dayjs(value).format('DD/MM/YYYY HH:mm');
  },
  localInputAfterDays(days: number): string {
    return dayjs().add(days, 'day').format('YYYY-MM-DDTHH:mm');
  },
  toUtcIso(value: ConfigType): string {
    const parsed = dayjs(value);
    if (!parsed.isValid()) throw new Error('Invalid date value');
    return parsed.utc().toISOString();
  },
  timezone(): string {
    return dayjs.tz.guess();
  },
};
