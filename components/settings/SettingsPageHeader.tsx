import Link from "next/link";

type SettingsPageHeaderProps = {
  title: string;
  description: string;
};

export default function SettingsPageHeader({
  title,
  description,
}: SettingsPageHeaderProps) {
  return (
    <>
      <Link
        href="/settings"
        className="text-sm font-medium text-gray-600 transition hover:text-black"
      >
        ← Back to settings
      </Link>

      <header className="mt-6">
        <p className="text-sm font-medium text-gray-500">Administration</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-gray-600">{description}</p>
      </header>
    </>
  );
}
