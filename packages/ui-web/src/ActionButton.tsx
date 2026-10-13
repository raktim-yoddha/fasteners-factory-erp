import type { CommandName, CommandPayload } from '@fasteners/contracts';
import { Button, type ButtonProps } from './components';
import { useFactory } from './context';
export function ActionButton<K extends CommandName>({
  command,
  payload,
  disabled,
  title,
  ...props
}: ButtonProps & { command: K; payload?: CommandPayload<K> }) {
  const { can, busy } = useFactory();
  const access = can(command, payload);
  return (
    <Button
      {...props}
      disabled={disabled || busy || !access.allowed}
      title={access.reason || title}
    />
  );
}
