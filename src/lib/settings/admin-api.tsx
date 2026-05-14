export const adminApiKeys = [
  {
    id: 'prod-spotless',
    name: 'Production · Spotless integration',
    token: 'wbn_live_••••••••••••••••3F2a',
    createdLabel: (
      <>
        Created <strong>21 Mar 2026</strong>
      </>
    ),
    usedLabel: (
      <>
        Used <strong>14m ago</strong>
      </>
    ),
  },
  {
    id: 'dev-local',
    name: 'Development · local testing',
    token: 'wbn_test_••••••••••••••••8Bc1',
    createdLabel: (
      <>
        Created <strong>4d ago</strong>
      </>
    ),
    usedLabel: (
      <>
        Used <strong>Yesterday</strong>
      </>
    ),
  },
];

export const adminWebhookEndpoint = {
  name: 'Spotless lead sync',
  url: 'https://api.spotless.app/v1/webhooks/webnua',
  eventCount: 14,
  scope: 'All clients',
};

export const adminWebhookEvents: {
  id: string;
  time: string;
  event: string;
  status: 'ok' | 'failed';
}[] = [
  { id: '1', time: '14:34:12', event: 'lead.created · FreshHome · Sarah Davies', status: 'ok' },
  { id: '2', time: '14:34:12', event: 'automation.sent · instant_confirm · sms', status: 'ok' },
  { id: '3', time: '14:21:55', event: 'review.received · KeyHero · Marcus H. · 5★', status: 'ok' },
  { id: '4', time: '13:48:01', event: 'booking.completed · FreshHome · Larsen', status: 'ok' },
  { id: '5', time: '12:30:44', event: 'lead.created · KeyHero · Stein', status: 'ok' },
];
