/**
 * Social Links & Contact Configuration
 * 
 * Update these URLs and contact information as needed.
 * All social icons across the footer, contact page, and institutional links reference this file.
 */

export interface SocialConfig {
  githubUrl: string;
  linkedinUrl: string;
  instagramUrl: string;
  recipientEmail: string;
  emailUrl: string;
  supportPhone?: string;
  institutionalDesk: {
    office: string;
    division: string;
    institution: string;
    workingHours: string;
    responseTime: string;
  };
}

export const SOCIAL_CONFIG: SocialConfig = {
  // Placeholder URLs - easily replace with your personal/official profiles
  githubUrl: 'https://github.com',
  linkedinUrl: 'https://linkedin.com',
  instagramUrl: 'https://instagram.com',

  // Official direct recipient email address
  recipientEmail: 'rqchit2009@gmail.com',
  emailUrl: 'mailto:rqchit2009@gmail.com',

  supportPhone: '+91 (080) 4123-8899',

  institutionalDesk: {
    office: 'Office of the Controller of Examinations',
    division: 'ScholarArchive Student Support & Academic Repository',
    institution: 'Autonomous Engineering Institution',
    workingHours: 'Monday – Friday: 9:00 AM – 5:00 PM IST',
    responseTime: 'Responses are typically dispatched within 24 institutional hours',
  },
};
