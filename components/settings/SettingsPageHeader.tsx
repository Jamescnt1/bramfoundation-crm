import PageHeader from "@/components/layout/PageHeader";

type SettingsPageHeaderProps = {
  title: string;
  description: string;
};

export default function SettingsPageHeader({
  title,
  description,
}: SettingsPageHeaderProps) {
  return (
    <PageHeader
      title={title}
      description={description}
      eyebrow="Administration"
      backHref="/settings"
      backLabel="Settings"
    />
  );
}
