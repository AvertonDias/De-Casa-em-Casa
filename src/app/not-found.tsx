import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-lg text-muted-foreground mb-6">Página não encontrada</p>
      <Link
        href="/"
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
      >
        Voltar para o início
      </Link>
    </div>
  );
}
