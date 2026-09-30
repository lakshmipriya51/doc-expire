import { getStatusMeta } from '../utils/status';

export default function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  return <span className={meta.className}>{meta.label}</span>;
}
