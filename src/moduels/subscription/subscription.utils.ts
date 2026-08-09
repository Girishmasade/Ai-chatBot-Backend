export const calculateSubscriptionEndDate = (startDate: Date, durationInDays: number): Date => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationInDays);
  return endDate;
};