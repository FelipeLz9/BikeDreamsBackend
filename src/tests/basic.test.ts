describe('Basic Test Suite', () => {
  test('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should work with strings', () => {
    expect('hello').toBe('hello');
  });

  test('should work with arrays', () => {
    expect([1, 2, 3]).toHaveLength(3);
  });

  test('should work with objects', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj).toHaveProperty('name');
    expect(obj.value).toBe(42);
  });
});
