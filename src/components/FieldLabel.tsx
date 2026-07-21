const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ion-text-color)', margin: '0 0 6px' }}>{children}</p>
);

export default FieldLabel;
