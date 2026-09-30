export default function Alert({ tone = 'info', title, children }) {
  if (!children && !title) return null;

  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title ? <strong className="alert__title">{title}</strong> : null}
      {children ? <div className="alert__body">{children}</div> : null}
    </div>
  );
}
