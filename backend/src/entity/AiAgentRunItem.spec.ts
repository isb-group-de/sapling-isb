import { AiAgentRunItem } from './AiAgentRunItem';
import { hasSaplingOption } from './global/entity.decorator';

describe('AiAgentRunItem', () => {
  it('provides the system timestamps and timeline date metadata', () => {
    const run = new AiAgentRunItem();

    expect(run.createdAt).toBeInstanceOf(Date);
    expect(run.updatedAt).toBeInstanceOf(Date);
    expect(
      hasSaplingOption(AiAgentRunItem.prototype, 'createdAt', 'isReadOnly'),
    ).toBe(true);
    expect(
      hasSaplingOption(AiAgentRunItem.prototype, 'createdAt', 'isSystem'),
    ).toBe(true);
    expect(
      hasSaplingOption(AiAgentRunItem.prototype, 'startedAt', 'isDateStart'),
    ).toBe(true);
    expect(
      hasSaplingOption(AiAgentRunItem.prototype, 'completedAt', 'isDateEnd'),
    ).toBe(true);
  });
});
