import type { ArticleStatus } from '@/lib/adminApi';

const LABEL: Record<ArticleStatus, string> = { draft: 'Draft', review: 'In review', published: 'Published' };

export default function StatusBadge({ status }: { status: ArticleStatus }) {
  return <span className={`status status-${status}`}>{LABEL[status]}</span>;
}
