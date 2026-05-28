
function normalizeStyle(style) {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean));
  }
  return style ?? {};
}

export default function MapView({ style, children }) {
  const resolvedStyle = normalizeStyle(style);

  return (
    <div
      style={{
        width: resolvedStyle.width ?? '100%',
        height: resolvedStyle.height ?? 260,
        minHeight: resolvedStyle.minHeight ?? 180,
        borderRadius: resolvedStyle.borderRadius ?? 12,
        backgroundColor: '#D1D5DB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#374151',
        fontSize: 14,
        fontWeight: 600,
        textAlign: 'center',
        padding: 12,
        ...resolvedStyle,
      }}
    >
      <span>Map not available on web</span>
      {children}
    </div>
  );
}

export function Marker() {
  return null;
}

export function Callout({ children }) {
  return children ?? null;
}
