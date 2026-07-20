const PageHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <header className="tl-page-header">
    <p className="tl-brand">ตั้งหลัก</p>
    <h1>{title}</h1>
    {subtitle && <p className="tl-subtitle">{subtitle}</p>}
  </header>
);

export default PageHeader;
