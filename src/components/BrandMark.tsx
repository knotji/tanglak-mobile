const BrandMark: React.FC<{ size?: number; inverted?: boolean }> = ({ size = 64, inverted = false }) => (
  <div
    aria-hidden="true"
    className={`tl-brand-mark${inverted ? ' tl-brand-mark--inverted' : ''}`}
    style={{ width: size, height: size }}
  >
    <span className="tl-brand-mark__pillar" />
    <span className="tl-brand-mark__horizon" />
    <span className="tl-brand-mark__sun" />
  </div>
);

export default BrandMark;
