import type { Metadata } from 'next';
import InfoPage from '@/components/InfoPage';

export const metadata: Metadata = { title: 'Privacy Policy · Punch NextGen' };

const EMAIL = 'contact@punchnextgen.com';

// NOTE: placeholder until Punch Nigeria Limited provides the final policy text.
export default function Privacy() {
  return (
    <InfoPage kicker="Punch NextGen" title="Privacy Policy">
      <p>Our full privacy policy is being finalised by Punch Nigeria Limited and will be published here soon.</p>
      <p>
        Questions about your information, or want something changed or removed? Email us at{' '}
        <a href={`mailto:${EMAIL}?subject=${encodeURIComponent('Privacy question')}`}>{EMAIL}</a>.
      </p>
    </InfoPage>
  );
}
