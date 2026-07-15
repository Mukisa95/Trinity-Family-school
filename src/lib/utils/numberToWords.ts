// Helper function to convert numbers/grades to words
export const numberToWords = (grade: string | number): string => {
  // Convert grade to string if it's a number
  const gradeStr = String(grade);
  
  const gradeMap: { [key: string]: string } = {
    '1': 'ONE',
    '2': 'TWO',
    '3': 'THREE',
    '4': 'FOUR',
    '5': 'FIVE',
    '6': 'SIX',
    '7': 'SEVEN',
    '8': 'EIGHT',
    '9': 'NINE',
    '10': 'TEN',
    '11': 'ELEVEN',
    '12': 'TWELVE',
    '13': 'THIRTEEN',
    '14': 'FOURTEEN',
    '15': 'FIFTEEN',
    '16': 'SIXTEEN',
    '17': 'SEVENTEEN',
    '18': 'EIGHTEEN',
    '19': 'NINETEEN',
    '20': 'TWENTY',
    '21': 'TWENTY ONE',
    '22': 'TWENTY TWO',
    '23': 'TWENTY THREE',
    '24': 'TWENTY FOUR',
    '25': 'TWENTY FIVE',
    '26': 'TWENTY SIX',
    '27': 'TWENTY SEVEN',
    '28': 'TWENTY EIGHT',
    '29': 'TWENTY NINE',
    '30': 'THIRTY',
    '31': 'THIRTY ONE',
    '32': 'THIRTY TWO',
    '33': 'THIRTY THREE',
    '34': 'THIRTY FOUR',
    '35': 'THIRTY FIVE',
    '36': 'THIRTY SIX',
    'D1': 'ONE',
    'D2': 'TWO',
    'C3': 'THREE',
    'C4': 'FOUR',
    'C5': 'FIVE',
    'C6': 'SIX',
    'P7': 'SEVEN',
    'P8': 'EIGHT',
    'F9': 'NINE'
  };
  
  // For total marks, directly return the word
  if (gradeMap[gradeStr]) {
    return gradeMap[gradeStr];
  }
  
  // If it's a numeric string, try to parse it
  const num = typeof grade === 'string' ? parseInt(grade, 10) : grade;
  if (!isNaN(num as number) && (num as number) > 0) {
    // Fallback for numbers not in the map
    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    const teens = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    
    if ((num as number) < 10) return ones[num as number];
    if ((num as number) < 20) return teens[(num as number) - 10];
    if ((num as number) < 100) {
      return tens[Math.floor((num as number) / 10)] + (num as number % 10 !== 0 ? ' ' + ones[(num as number) % 10] : '');
    }
  }
  
  return '';
};
