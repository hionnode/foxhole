export const getStartOfDay = (date?: Date): number => {
  const d = date ?? new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export const getEndOfDay = (date?: Date): number => {
  const d = date ?? new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
};

export const getLocalDateString = (timestamp?: number): string => {
  const date = timestamp ? new Date(timestamp) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getYesterdayString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d.getTime());
};
