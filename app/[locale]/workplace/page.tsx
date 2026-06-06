import { redirect } from 'next/navigation';

// /[locale]/workplace is not a real page — the workplace is a client-side
// variant of the home route, selected via ?variant=workplace (also how the
// variant rail and WeChat OAuth callback open it). Deep links like
// molamaker.cn/zh/workplace used to 404; redirect them to the variant instead.
export default async function WorkplaceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}?variant=workplace`);
}
