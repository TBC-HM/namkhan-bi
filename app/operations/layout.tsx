// Pass-through layout — strips any global chrome (sidebar, header)
// so the entry page renders full-viewport black without decoration.
export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
