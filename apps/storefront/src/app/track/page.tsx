import {
  redirect,
} from 'next/navigation';

export default function LegacyTrackPage() {
  redirect(
    '/orders',
  );
}
