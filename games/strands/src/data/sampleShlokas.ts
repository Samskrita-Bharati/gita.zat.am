// Temporary content adapter fixtures. Replace with the shared shloka/word functions later.
export type ShlokaContent = { id: number; chapter: number; verse: number; text: string; words: string[] };
export const SAMPLE_SHLOKAS: ShlokaContent[] = [
  {
    id: 1, chapter: 1, verse: 1,
    text: 'धृतराष्ट्र उवाच\nधर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।\nमामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय।।1.1।।',
    words: ['धर्मक्षेत्रे', 'कुरुक्षेत्रे', 'समवेता', 'युयुत्सवः', 'मामकाः', 'पाण्डवाश्चैव', 'किमकुर्वत', 'सञ्जय'],
  },
  {
    id: 2, chapter: 1, verse: 2,
    text: 'सञ्जय उवाच\nदृष्ट्वा तु पाण्डवानीकं व्यूढं दुर्योधनस्तदा।\nआचार्यमुपसङ्गम्य राजा वचनमब्रवीत्।।1.2।।',
    words: ['दृष्ट्वा', 'तु', 'पाण्डवानीकं', 'व्यूढं', 'दुर्योधनस्तदा', 'आचार्यमुपसङ्गम्य', 'राजा', 'वचनमब्रवीत्'],
  },
];
