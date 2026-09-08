import { GenericMutationMetadata } from './generic-mutation-metadata';
describe('Batch mutation metadata', () => {
  it('loads shared metadata once in a 50-record operation but refreshes it for the next operation', async () => {
    const loader = jest.fn().mockResolvedValue([]);
    const batch = new GenericMutationMetadata();
    await Promise.all(
      Array.from({ length: 50 }, () => batch.getTemplates('event', loader)),
    );
    expect(loader).toHaveBeenCalledTimes(1);
    await new GenericMutationMetadata().getTemplates('event', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
