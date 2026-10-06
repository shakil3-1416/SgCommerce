import {
  notFound,
} from 'next/navigation';

import {
  DeveloperApplicationDetail,
} from '@/components/developer-application-detail';

import {
  developerApiUrl,
  getDeveloperApplication,
} from '@/lib/api';

type Params = Promise<{
  appId: string;
}>;

export default async function DeveloperApplicationPage({
  params,
}: {
  params: Params;
}) {
  const { appId } = await params;

  let detail: any;

  try {
    detail =
      await getDeveloperApplication(appId);
  } catch (error) {
    // An id that names no application is a missing page, not a crash.
    if (
      error instanceof Error &&
      error.message.includes('404')
    ) {
      notFound();
    }

    throw error;
  }

  return (
    <DeveloperApplicationDetail
      /*
       * No "key" here on purpose: after a key is replaced the page data
       * is reloaded, and the screen must not be rebuilt, or the new key,
       * which is shown only once, would vanish before it is copied.
       */
      initialApplication={detail.application}
      usage={detail.usage}
      recentRequests={detail.recentRequests ?? []}
      events={detail.events ?? []}
      scopes={detail.scopes ?? []}
      expiryChoices={detail.expiryChoices ?? [0]}
      rollGraceChoices={detail.rollGraceChoices ?? [0]}
      apiUrl={developerApiUrl()}
    />
  );
}
