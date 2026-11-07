import test from 'node:test'
import assert from 'node:assert/strict'
import { matchKeyword, shouldIgnoreComment } from '../rules.mjs'
import { extractCommentEvents } from '../webhook.mjs'

const keywords = [
  {
    match: 'MENU',
    mode: 'exact',
    case_insensitive: true,
    reply: 'go whatsapp',
  },
]

test('match exact MENU case-insensitive', () => {
  assert.equal(matchKeyword('MENU', keywords)?.reply, 'go whatsapp')
  assert.equal(matchKeyword('menu', keywords)?.reply, 'go whatsapp')
  assert.equal(matchKeyword('Please MENU', keywords)?.reply, 'go whatsapp')
  assert.equal(matchKeyword('hello', keywords), null)
})

test('ignore own username', () => {
  const rules = { ignore_usernames: ['order.ammachethiruchulu'], ig_user_id: '111' }
  assert.equal(
    shouldIgnoreComment({ from: { username: 'order.ammachethiruchulu' } }, rules),
    true,
  )
  assert.equal(shouldIgnoreComment({ from: { id: '111' } }, rules), true)
  assert.equal(shouldIgnoreComment({ from: { username: 'someone' } }, rules), false)
})

test('extract comments from instagram webhook shape', () => {
  const payload = {
    object: 'instagram',
    entry: [
      {
        id: '17841442342112674',
        changes: [
          {
            field: 'comments',
            value: {
              id: 'c1',
              text: 'MENU',
              from: { id: 'u1', username: 'tester' },
              media: { id: 'm1' },
            },
          },
        ],
      },
    ],
  }
  const events = extractCommentEvents(payload)
  assert.equal(events.length, 1)
  assert.equal(events[0].commentId, 'c1')
  assert.equal(events[0].text, 'MENU')
})
