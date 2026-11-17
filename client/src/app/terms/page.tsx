import type { Metadata } from 'next';
import InfoPage from '@/components/InfoPage';

export const metadata: Metadata = { title: 'Terms of Use · Punch NextGen' };

const EMAIL = 'contact@punchnextgen.com';

// NOTE: placeholder until Punch Nigeria Limited provides the final terms.
export default function Terms() {
  return (
    <InfoPage kicker="Punch NextGen" title="Terms of Use">
      <p>Our full terms of use are being finalised by Punch Nigeria Limited and will be published here soon.</p>
      <p>
        Any questions in the meantime? Email us at{' '}
        <a href={`mailto:${EMAIL}?subject=${encodeURIComponent('Terms of use question')}`}>{EMAIL}</a>.
      </p>
    </InfoPage>
  );
}
