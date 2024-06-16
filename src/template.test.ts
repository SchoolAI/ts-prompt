import { describe, test, expect } from 'vitest'
import { Template, combineTemplates } from './template'

describe('Testing Template', () => {
  test('Render a Template without placeholders', () => {
    const tpl = Template.build('Hello there!')

    expect(tpl.render()).toBe('Hello there!')
  })

  test('Render a Template with one unique placeholder', () => {
    const tpl = Template.build('Hello {{greet}}!')

    expect(tpl.render({ greet: 'World' })).toBe('Hello World!')
  })

  test('Render a Template with two unique placeholders', () => {
    const tpl = Template.build('Hello {{greet}}! My name is {{name}}.')

    expect(tpl.render({ greet: 'World', name: 'Rosie' })).toBe(
      'Hello World! My name is Rosie.',
    )
  })

  test('Render a Template with one placeholder used several times', () => {
    const tpl = Template.build(
      'Hello {{greet}}! Wait, are you really {{greet}}?',
    )

    expect(tpl.render({ greet: 'World' })).toBe(
      'Hello World! Wait, are you really World?',
    )
  })

  test('Render a Template with one placeholder used correctly once and once without closing delimiter', () => {
    const tpl = Template.build('Hello {{greet}}! Wait, are you really {{greet?')

    expect(tpl.render({ greet: 'World' })).toBe(
      'Hello World! Wait, are you really {{greet?',
    )
  })

  test('Template is rendered with resulting string unindented', () => {
    const tpl = Template.build(`
      Hello {{greet}}!
      Wait, are you really {{greet}}?
    `)

    expect(tpl.render({ greet: 'World' })).toBe(
      'Hello World!\nWait, are you really World?\n',
    )
  })

  test('Template can be concatenated with another Template and types are preserved', () => {
    const t1 = Template.build('hello {{name}}')
    const t2 = Template.build('{{fruit}} flavor')
    const tpl = combineTemplates(t1, t2)

    expect(tpl.render({ name: 'Rosie', fruit: 'apple' })).toBe(
      'hello Rosie\napple flavor',
    )
  })

  test('Several Templates can be combined', () => {
    const t1 = Template.build('hello {{name}}')
    const t2 = Template.build('{{fruit}} flavor')
    const t3 = Template.build('good {{occasion}}')

    const tpl = combineTemplates(t1, t2, t3)

    expect(tpl.render({ name: 'Rosie', fruit: 'apple', occasion: 'day' })).toBe(
      'hello Rosie\napple flavor\ngood day',
    )
  })
})
