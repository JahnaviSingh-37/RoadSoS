import emergencyNumbers from '@/utils/emergencyNumbers.json';

export function getEmergencyNumbers(countryCode) {
  const normalizedCode = (countryCode ?? '').toUpperCase();
  return emergencyNumbers[normalizedCode] ?? emergencyNumbers.default;
}
