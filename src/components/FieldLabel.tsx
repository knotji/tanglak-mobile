const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize: 13, fontWeight: 700, color: '#334155', margin: '0 0 6px', letterSpacing: '-0.01em' }}>{children}</p>
);

export default FieldLabel;
