---
to: components/<%= level %>/<%= name %>/<%= name %>.tsx
unless_exists: true
---
interface Props {
  purpose?: string;
}

export const <%= name %>: React.FC<Props> = () => {
  return (
    <>
    </>
  );
};