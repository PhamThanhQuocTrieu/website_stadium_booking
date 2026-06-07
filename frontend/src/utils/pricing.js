export const normalizeTime = (time) => {
  const [hour = 0, minute = 0] = String(time || '00:00').split(':').map(Number);
  return `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
};

export const timeToMinutes = (time) => {
  const [hour, minute] = normalizeTime(time).split(':').map(Number);
  return hour * 60 + minute;
};

export const getDayType = (date = new Date()) => {
  const day = date.getDay();
  return day === 0 || day === 6 ? 'Weekend' : 'Weekday';
};

const isTimeInRange = (slotMinutes, startMinutes, endMinutes) => {
  if (startMinutes === endMinutes) return true;
  if (endMinutes > startMinutes) {
    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  }

  return slotMinutes >= startMinutes || slotMinutes < endMinutes;
};

export const findPricingRule = (pricingRules = [], date = new Date(), time = null) => {
  const validRules = pricingRules.filter((rule) => Number(rule.price || 0) > 0);
  if (validRules.length === 0) return null;

  const dayType = getDayType(date);
  const sameDayRules = validRules.filter((rule) => rule.dayType === dayType);
  const candidateRules = sameDayRules.length > 0 ? sameDayRules : validRules;
  const slotTime = time || normalizeTime(`${date.getHours()}:${date.getMinutes()}`);
  const slotMinutes = timeToMinutes(slotTime);

  const matchedRule = candidateRules.find((rule) => {
    const startMinutes = timeToMinutes(rule.startTime);
    const endMinutes = timeToMinutes(rule.endTime);
    return isTimeInRange(slotMinutes, startMinutes, endMinutes);
  });

  if (matchedRule) return matchedRule;

  return candidateRules.reduce((lowest, rule) => {
    return Number(rule.price || 0) < Number(lowest.price || 0) ? rule : lowest;
  }, candidateRules[0]);
};

export const getRulePrice = (pricingRules = [], date = new Date(), time = null) => {
  const rule = findPricingRule(pricingRules, date, time);
  return rule ? Number(rule.price || 0) : 0;
};
