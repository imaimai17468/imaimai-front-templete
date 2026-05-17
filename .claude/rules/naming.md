# Naming

## Three Patterns Based on English Grammar

Identifiers fall into three grammatical patterns. Names that don't follow these patterns introduce ambiguity.

### Pattern 1: Command (Functions / Methods)

Start with a verb in its base form. The name reads as an imperative sentence that conveys "what to do" without a subject.

```tsx
// Basic: verb + object
findUserById(id)
activateUsers()
fetchArticles()

// Conversion: to-syntax
toString()
stringToInt(value)

// Get/set: SVOC sentence pattern
getEnabled()
setEnabled(true)
```

### Pattern 2: Thing / Concept / Person (Variables / Types / Classes)

Use noun phrases. A central noun modified by adjectives, participles, or prepositional phrases.

```tsx
// Adjective + noun
activeUsers
selectedItems

// Present participle (action performed by the subject)
runningProcesses

// Past participle (action received by the object)
usersRemovedByAdmin
filteredArticles

// To-infinitive (future action)
usersToRemove
itemsToProcess
```

Do not use gerunds (-ing) as the head noun. They are ambiguous between "the agent performing the action" and "the feature/concept."

```tsx
// NG — ambiguous: the agent selecting? or the selection feature?
selectingUsers
usersSelecting

// OK
usersSelection
selectedUsers
```

### Pattern 3: Proposition (Boolean Variables)

The name should read as a declarative sentence: subject + verb.

```tsx
// be-verb (passive — describes a received action, acceptable)
item.isDisabled
input.isRequired

// General verbs
array.contains(something)
form.hasEmptyFields

// Modal verbs (preferred for React state/props — expresses purpose)
artifact.canDeploy
dialog.shouldOpen
props.willOpenConfirmDialog
button.canSubmit
```

Omitting the be-verb is acceptable (`enabled`, `visible`, etc.).

For React state flags, props, and hook options, prefer **modal verbs** (`can`, `should`, `will`) over be-verb + adjective (`isActive`, `isAuthenticated`). See hooks.md "Boolean Flag Naming" for details.

### Event Handler Naming

Name event handlers by **user intent**, not by the interaction mechanism (click, tap, etc.).

```tsx
// NG — interaction mechanism is in the name
<Toolbar onClickPlayButton={() => { ... }} />

// OK — focuses on the user's intent
<Toolbar onPlayMovie={() => { ... }} />
```

## Dictionary Usage

Google Translate favors broad, high-frequency words — not ideal for naming. Use an English-English dictionary (e.g., LDOCE) to verify precise meaning, and search `"(word) synonym"` to compare alternatives. Choose words based on contrast relationships, not direct translation.
