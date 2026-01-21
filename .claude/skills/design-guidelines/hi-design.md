# Sociomedia Human Interface Guidelines

> Source: [Sociomedia Interface Guidelines](https://www.sociomedia.co.jp/category/shig)
>
> This document compiles 100 human interface design guidelines curated by Sociomedia, Inc.

## Table of Contents

### Core Principles (1-10)
1. [Simplicity](#1-simplicity)
2. [Ease of Use](#2-ease-of-use)
3. [Mental Model](#3-mental-model)
4. [Signifier](#4-signifier)
5. [Mapping](#5-mapping)
6. [Consistency](#6-consistency)
7. [User Control](#7-user-control)
8. [Direct Manipulation](#8-direct-manipulation)
9. [Modelessness](#9-modelessness)
10. [Visual Gestalt](#10-visual-gestalt)

### Communication (11-24)
11. [Users' Language](#11-users-language)
12. [Minimize Memory Load](#12-minimize-memory-load)
13. [Constraint](#13-constraint)
14. [Precomputation](#14-precomputation)
15. [Avoid Errors](#15-avoid-errors)
16. [Fitts' Law](#16-fitts-law)
17. [Hick's Law](#17-hicks-law)
18. [Tesler's Law](#18-teslers-law)
19. [Task Coherence](#19-task-coherence)
20. [Optimize for Major Tasks](#20-optimize-for-major-tasks)
21. [Persuasion](#21-persuasion)
22. [Shortcuts](#22-shortcuts)
23. [Object-Based Design](#23-object-based-design)
24. [Object Representation](#24-object-representation)

### Object-Oriented UI (25-36)
25. [Objects Reflect State](#25-objects-reflect-state)
26. [Noun-Verb Paradigm](#26-noun-verb-paradigm)
27. [Tone & Manner](#27-tone--manner)
28. [Information Over Data](#28-information-over-data)
29. [Automate Single Options](#29-automate-single-options)
30. [Pen Near Paper](#30-pen-near-paper)
31. [Visual Identity with Text](#31-visual-identity-with-text)
32. [Prerequisites First](#32-prerequisites-first)
33. [Noun-Based Navigation](#33-noun-based-navigation)
34. [Icon as Noun or Adjective](#34-icon-as-noun-or-adjective)
35. [Data Binding](#35-data-binding)
36. [Zero One Infinity](#36-zero-one-infinity)

### Form Design (37-48)
37. [Every Control Has Meaning](#37-every-control-has-meaning)
38. [User Owns Inputs](#38-user-owns-inputs)
39. [Avoid Inconsistent Input](#39-avoid-inconsistent-input)
40. [Form Story](#40-form-story)
41. [Create Flow](#41-create-flow)
42. [Good Defaults](#42-good-defaults)
43. [Constrained Controls](#43-constrained-controls)
44. [Positive Wording](#44-positive-wording)
45. [Results Over Values](#45-results-over-values)
46. [Structure Input Controls](#46-structure-input-controls)
47. [Specific Verbs](#47-specific-verbs)
48. [Radio vs Checkbox](#48-radio-vs-checkbox)

### Interaction (49-62)
49. [Avoid Flip-Flop](#49-avoid-flip-flop)
50. [Don't Require Accuracy](#50-dont-require-accuracy)
51. [Input Suggestions](#51-input-suggestions)
52. [Avoid False Bottom](#52-avoid-false-bottom)
53. [Option Previews](#53-option-previews)
54. [Fail-Safe Over Fool-Proof](#54-fail-safe-over-fool-proof)
55. [Constructive Error Messages](#55-constructive-error-messages)
56. [Probable vs Possible](#56-probable-vs-possible)
57. [Do, Don't Ask](#57-do-dont-ask)
58. [Show Guts](#58-show-guts)
59. [Wayfinding](#59-wayfinding)
60. [Escape Hatch](#60-escape-hatch)
61. [Instant Gratification](#61-instant-gratification)
62. [Deferred Choices](#62-deferred-choices)

### Visual Feedback (63-72)
63. [Animate Transitions](#63-animate-transitions)
64. [Bidirectional Transitions](#64-bidirectional-transitions)
65. [0.1 Second Response](#65-01-second-response)
66. [Feedback Near Operation](#66-feedback-near-operation)
67. [Progressive Disclosure](#67-progressive-disclosure)
68. [Culturally Independent Icons](#68-culturally-independent-icons)
69. [Multilingual Label Length](#69-multilingual-label-length)
70. [Avoid Cultural Symbols](#70-avoid-cultural-symbols)
71. [Idiomatic Over Intuitive](#71-idiomatic-over-intuitive)
72. [Platform Button Order](#72-platform-button-order)

### Layout & Visual Design (73-86)
73. [Fixed Menu Positions](#73-fixed-menu-positions)
74. [Single Element Highlight](#74-single-element-highlight)
75. [Optical Illusions](#75-optical-illusions)
76. [Spatial Memory](#76-spatial-memory)
77. [Prospective Memory](#77-prospective-memory)
78. [7mm Touch Target](#78-7mm-touch-target)
79. [Direct Gesture Manipulation](#79-direct-gesture-manipulation)
80. [Top-Bottom, Left-Right Drilldown](#80-top-bottom-left-right-drilldown)
81. [Left Goes Back, Right Forward](#81-left-goes-back-right-forward)
82. [Hierarchical for Mobile](#82-hierarchical-for-mobile)
83. [Keep Simple Things Simple](#83-keep-simple-things-simple)
84. [Few Colors and Fonts](#84-few-colors-and-fonts)
85. [Layout Tidily](#85-layout-tidily)
86. [Less Customization](#86-less-customization)

### User Experience & Accessibility (87-100)
87. [User's Tool](#87-users-tool)
88. [User's Own Method](#88-users-own-method)
89. [Let Users Learn](#89-let-users-learn)
90. [Don't Lock UI](#90-dont-lock-ui)
91. [Don't Bring Games](#91-dont-bring-games)
92. [Move As User Wants](#92-move-as-user-wants)
93. [Expand Hotspots](#93-expand-hotspots)
94. [Screen Reader Support](#94-screen-reader-support)
95. [Text Enlargement Support](#95-text-enlargement-support)
96. [Avoid Color Dependence](#96-avoid-color-dependence)
97. [User's Own Pace](#97-users-own-pace)
98. [User Illusion](#98-user-illusion)
99. [Design Proposes Meaning](#99-design-proposes-meaning)
100. [Positive Human Impact](#100-positive-human-impact)

---

## Core Principles (1-10)

### 1. Simplicity

**Concept**: Curate features and information. Minimize elements.

**Key Points**:
- Fundamental principle across all design disciplines
- Reduce superfluous elements, curate functionality and information
- Related to progressive disclosure, limiting color/font usage, and restraining customization

**Example**: Google's search page is a canonical example of simple design.

---

### 2. Ease of Use

**Concept**: Streamline usage patterns. Minimize steps and effort to achieve goals.

**Key Points**:
- Focus on reducing operational steps
- Based on cognitive science and UI design principles (Fitts' Law, Hick's Law, Tesler's Law)
- Task optimization and shortcut functionality
- Automate when only one user action is possible
- Present prerequisites upfront
- Provide immediate feedback

**Example**: Minimize differences between operations requiring one click versus two clicks.

---

### 3. Mental Model

**Concept**: Align structure and behavior with users' imagined usage model. Provide usage models through learnable idioms. Convey concepts and functionality through metaphors.

**Key Points**:
- **User-centered design**: Align system structure with user expectations
- **Learnable patterns**: Enable natural learning through idiomatic expressions
- **Metaphor usage**: Communicate abstract concepts through understandable analogies

**Example**: Apple iBooks' bookshelf interface applies the real-world metaphor of physical bookshelves to a digital environment.

---

### 4. Signifier

**Concept**: Make interactive elements visible and their meaning immediately clear.

**Key Points**:
- Leverage known expressions
- Use self-evident shapes
- **Visual mapping**: Buttons should look pressable; non-interactive elements should not

**Example**: Clearly distinguish buttons from labels.

---

### 5. Mapping

**Concept**: Make the relationship between controls and their effects comprehensible. Provide cues through position, shape, color, and symbols.

**Key Points**:
- Make cause-and-effect relationships intuitively understandable
- Visual positioning connects controls to results

**Example**: Gas stove designs where the switch-to-burner mapping is obvious are superior to those where the correspondence is unclear.

---

### 6. Consistency

**Concept**: Apply consistent rules for color, shape, placement, and behavior. Same properties use same expressions; different properties use different expressions.

**Key Points**:
- Consistency expresses design logic
- Fundamental cue for users to infer and learn system usage
- Unified graphic tone & manner
- Data binding
- Maintain integrity
- Consistent button placement
- Preserve menu item positions

**Example**: Twitter's consistent screen design across three different window sizes.

---

### 7. User Control

**Concept**: Don't unilaterally restrict user actions based on system convenience. Let users control the system.

**Key Points**:
- Users should control the system, not vice versa
- Respect user decision-making
- Freedom to work at own pace

**Avoid**:
- Forced operations based on system needs
- Unilateral restrictions on user behavior

**Example**: Windows update screens that make users wait "This may take several minutes" exemplify undesirable design patterns.

---

### 8. Direct Manipulation

**Concept**: Create the sensation of directly touching and manipulating on-screen objects.

**Three Essential Principles**:
1. **Real-time feedback**: Follow physical actions with immediate display updates
2. **Reversibility**: Reverse operations can restore previous states
3. **Intuitiveness**: Recreate the sensation of physical tactile manipulation

**Related Principles**: Forms a unified system of object-oriented UI design.

---

### 9. Modelessness

**Concept**: Let users work in any order.

**Mode Definition**: A state where an operation's meaning depends on context, limiting available operations or forcing fixed operation sequences.

**Modeless Benefits**:
- Operation meaning remains constant
- Users can work in any order
- Can switch to different tasks anytime
- Basic condition for usable UI

**Example**: Comparing modal dialogs versus modeless settings panels.

---

### 10. Visual Gestalt

**Concept**: Human perception recognizes objects not as individual elements but from overall frameworks. Leverage patterns like proximity, similarity, and closure.

**Key Points**:
- **Pattern recognition**: Proximity, similarity, closure
- **Implementation**: Use Prägnanz principles for layout
- **Design effect**: Users recognize information as integrated patterns, not individual elements

---

## Communication (11-24)

### 11. Users' Language

**Concept**: Use general expressions from users' everyday vocabulary, not system-internal technical terms or industry jargon.

**Key Points**:
- Users understand everyday expressions better than industry terminology
- Avoid technical terms, use common language

**Example**: In flight search interfaces, display common airport names like "Narita International Airport" rather than airport codes like "NRT" alone.

---

### 12. Minimize Memory Load

**Concept**: Reference information must be available when needed. Don't assume users remember things.

**Key Points**:
- The system bears responsibility for providing necessary reference information at the moment users need it
- Don't assume retention of past information

**Examples**:
- **Recommended**: Forms displaying error messages near input fields
- **Avoid**: Forms displaying all errors collectively in modal dialogs

---

### 13. Constraint

**Concept**: Partially and deliberately restrict user actions to reduce errors and encourage effective usage.

**Key Points**:
- Appropriate constraints enhance user experience over complete freedom
- Strategic use of limitations

**Example**: Scissor handle shapes constrain grip method, ensuring blades are always correctly oriented.

---

### 14. Precomputation

**Concept**: Use optimal values already discovered by predecessors as presets or reuse them in design processes.

**Key Points**:
- Pre-solve decisions and calculations users would repeatedly perform
- Dramatically improves usability and efficiency

**Examples**:
- Rice cooker markings - optimal water levels indicated by gradations
- Microwave - preset timers for different dishes
- Automatic transmission - shift timing automated
- Washlet - target pre-positioned

---

### 15. Avoid Errors

**Concept**: While clear error messages matter, preventing errors from occurring is more important.

**Implementation Methods**:
1. **Clear differentiation**: Clearly distinguish confusing elements
2. **Disable functionality**: Make contextually meaningless operations unavailable
3. **Gradual enablement**: Keep buttons disabled until necessary input is complete

---

### 16. Fitts' Law

**Concept**: Closer and larger targets are easier to point at; distant and smaller targets are harder.

**Ease of Pointing Order**:
1. Current pointer position
2. Screen corners
3. Screen edges (top, bottom, left, right)
4. Large and close items
5. Small and distant items

**Key Point**: Mouse cursor stops at screen edges, making edge targets effectively have very large interaction areas.

**Application**: This law applies to touchscreens as well.

---

### 17. Hick's Law

**Concept**: Choosing one option from many takes time proportional to the number of choices.

**Key Points**:
- User decision time is proportional to the entropy of the selection task
- More menu options increase decision time

**Applicability Limitation**: This law applies to simple reaction tasks but not when decisions require complex thinking.

---

### 18. Tesler's Law

**English**: Tesler's Law of Conservation of Complexity

**Concept**: Process simplification has limits. Complexity cannot be eliminated, only relocated. Design by moving complexity from users to the system enhances operability.

**Key Points**:
- Complexity cannot be reduced, only relocated
- Move complexity from user to system

**Example**: In email systems, sender and recipient addresses are essential (irreducible complexity), but incorporating default values and input completion features into the system reduces user workload.

---

### 19. Task Coherence

**Concept**: Users are likely to do today what they did yesterday. Predicting user behavior by remembering their last action is highly effective.

**Implementation**:
1. **Resume previous state**: Restore previous session's task when reopening application
2. **Show recent items**: Display menus based on access history

**Example**: Implementing "Recent Items" menus.

---

### 20. Optimize for Major Tasks

**Concept**: Surface information and features for tasks most users perform.

**Key Points**:
- Based on Pareto principle: "80% of users use only 20% of all features"
- Treating all features equally results in unusable design for everyone
- Prioritize addressing major requirements

**Example**: Comparing rental car website approaches: featuring reservation functionality versus featuring function menus.

---

### 21. Persuasion

**Concept**: Use persuasive mechanisms to encourage user behavior.

**Main Techniques**:
- Usage guides
- Recommendations (personalized suggestions)
- Psychological rewards (achievement feelings, badges)
- Social comparison
- Simulated experiences (AR, simulations)

**Important Note**: Persuasion requires ethics—avoid unconsciously manipulating user behavior or unduly suppressing free will.

**Examples**:
- macOS post-installation scroll method tutorial
- Amazon recommendation features
- Apple Watch activity achievement displays

---

### 22. Shortcuts

**Concept**: Provide ways for experienced users to perform frequent actions faster than standard step-by-step operations.

**Methods Provided**:
- Keyboard shortcuts
- Bookmarks/favorites
- Gesture operations
- History/recent items menus
- Type-ahead
- Context menus

---

### 23. Object-Based Design

**Concept**: Extract objects from requirements and reflect them in UI.

**Key Points**:
- Presenting requirements as mere procedural steps lacks operational cohesion, is inefficient, and unclear
- Object-oriented user interfaces (OOUI) let users achieve goals by working directly with target objects

**Example**: In an application managing books and authors, extract "Book" and "Author" as objects and make them the basis for UI structure.

**Design Methodology**: The process of extracting concrete procedures from abstract requirements, reorganizing into abstract principles, and finally deriving concrete designs is critical.

---

### 24. Object Representation

**English**: Object Representation by Views

**Concept**: Interfaces consist of views representing objects (targets of user interest).

**Key Points**:
- **Multiple representation principle**: Single objects can have multiple representational forms through different views
- **Specific view forms**: Icon view, list view, detail view
- **Holistic construction**: These view combinations form the integrated impression through which users perceive the entire system

---

## Object-Oriented UI (25-36)

### 25. Objects Reflect State

**Concept**: All on-screen objects must visually and continuously embody their own state in real-time.

**Example**: Multiple states of a file icon:
- Normal state
- Selected state
- Dragging state
- Locked state
- Hidden file state
- Downloading state
- Preview showing content state

**Key Point**: Users recognize these state changes through interactive manipulation, progressively moving their work toward the goal state.

---

### 26. Noun-Verb Paradigm

**Concept**: Users first select an object (noun), then choose an action (verb).

**Key Points**:
- Selecting action first creates "waiting for object selection" mode, reducing operational freedom
- In object-orientation, also called "Object-Verb Syntax"

**Examples**:
- **Good**: Select item from list, then press "Open" button
- **Bad**: Press "Open" button first, then select item

---

### 27. Tone & Manner

**Concept**: Align degrees of color tone/saturation/brightness, gradients, borders, shadows, corners, fill and stroke, line thickness, color/silhouette, and concrete/abstract across graphic elements.

**Elements to Unify**:
- Color tone, saturation, brightness
- Gradient expression
- Border/outline style
- Shadow application method
- Corner treatment (sharp vs rounded)
- Fill and stroke usage patterns
- Line thickness
- Color representation
- Silhouette representation
- Level of abstraction vs concreteness

---

### 28. Information Over Data

**Concept**: Users want to know meaning rather than numbers. Present meaningful information rather than raw numerical data.

**Examples**:
1. **Storage display**: Visual percentage of remaining capacity is more useful than exact byte count
2. **Music player**: "How many songs can be stored" is more useful for purchase decisions than exact GB count

---

### 29. Automate Single Options

**Concept**: When users have only one available action, the system should handle it automatically.

**Application Examples**:
1. **Error screens**: If only "back" is available on error screen, automatically go back
2. **Single-option dropdown**: If only one option, use a button instead
3. **Modal dialogs**: Modal dialogs without cancel are usually unnecessary
4. **Search interfaces**: If screen only has search box, automatically focus the text field

**Key Point**: High information efficiency UI allows complex input with minimal operations.

---

### 30. Pen Near Paper

**Concept**: Place tools near their target objects. Having objects visible but requiring separate window access is like leaving desk to find pen in hallway.

**Implementation Points**:
- Enable modeless operations
- Create environment for sequential result verification
- Minimize distance between target objects and operation tools

**Example**: Excel formatting comparing ribbon modeless settings versus modal dialog settings.

---

### 31. Visual Identity with Text

**English**: Visually Show What, Textually Tell Which

**Concept**: Make object existence and state visually comprehensible, supplemented with text information.

**Implementation**:
1. **Visual and text complementarity**: Visual elements aid recognition, text provides detailed information
2. **Icon usage**: Combine with labels to clarify item properties
3. **Graphical representation**: Illustrate data, supplement with numbers

**Examples**:
- Mac System Preferences icon-label display
- File copy progress bars with percentage display

---

### 32. Prerequisites First

**Concept**: Requiring prerequisite conditions midway through or at the end of long procedures risks wasting users' effort.

**Key Points**:
- Present prerequisites upfront to reduce user frustration
- Input information requiring external reference
- Terms or policies requiring agreement

**Example**: Avoid scenarios requesting agreement to terms after completing multi-page input forms.

---

### 33. Noun-Based Navigation

**Concept**: Task-based navigation items make it unclear what's available and create similar-looking screens. Organize screens by information type and express navigation items as nouns.

**Examples**:
- **Twitter app**: Changed from verb expressions like "Connect" "Discover" to concrete nouns "Notifications" "Messages"
- **Intercom**: Improved from "Engage" "Respond" "Educate" to "Messages" "Inbox" "Articles"
- **Business applications**: Using business process names as verb menus disperses screens; concrete noun expressions like entity names are recommended

---

### 34. Icon as Noun or Adjective

**Concept**: Icons should be based on the object they symbolize (noun) or the resulting state from selecting them (adjective).

**Important Distinction**:
- **Recommended**: Nouns (concrete objects like styles, buttons), adjectives (visual states from selection results)
- **Avoid**: Verbs (processes or operations) are difficult to illustrate and incomprehensible without labels

**Examples**:
- **Label unnecessary**: Style specification button icons (visual results are clear)
- **Label necessary**: Open, save, copy, paste (meaning requires separate memorization)

---

### 35. Data Binding

**Concept**: When the same object appears simultaneously in multiple views on screen, constantly synchronize their states.

**Key Points**:
- Bidirectional real-time updates let users feel they're working directly with target objects without being conscious of internal data processing
- When single object displays in multiple views, bind display states to the model object

**Example**: In Mac Finder, renaming a file updates the bound model object, and other view file name displays update in real-time.

---

### 36. Zero One Infinity

**English**: Zero One Infinity Rule

**Concept**: Don't create arbitrary specifications regarding quantity. Element counts should fundamentally be limited to 0 (nonexistent), 1 (unique), or infinity (unlimited).

**Application Areas**:
- List item counts
- Folder hierarchy structures
- Input field character limits
- Any user-increasable elements

**Critical Implementation Point**: Ensure UI doesn't break regardless of quantity. Require solutions like overflow menus for accessibility.

---

## Form Design (37-48)

### 37. Every Control Has Meaning

**Concept**: All currently operable elements or selectable items on screen must have some meaning for the user's task.

**Key Points**:
- All operable interface elements must relate to task achievement
- Meaningless elements confuse users and become obstacles to task completion

**Implementation**: Disable or hide unnecessary elements.

---

### 38. User Owns Inputs

**Concept**: All values and settings users input should fundamentally be saved.

**Three Basic Principles**:
1. **Save obligation**: Save all user-input values and settings
2. **Delete rights**: Users can delete items they added
3. **Edit rights**: Users can modify content they input

**Example**: Amazon account settings screen where users can directly change their name.

**Importance**: Foundation for ensuring user autonomy and trust in user experience.

---

### 39. Avoid Inconsistent Input

**English**: Don't Let Inconsistent Input

**Concept**: Don't request operations that could compromise information integrity. Don't make users manually turn on brake lights.

**Key Points**:
- Don't request duplicate input of information the system should automatically manage
- Minimize user input burden

**Example**: Don't request both birthdate and age. Age can be automatically calculated from birthdate; requesting both creates potential contradictions.

---

### 40. Form Story

**English**: Give Form A Story

**Concept**: Optimize user experience through input item composition and sequencing.

**Two Basic Principles**:
1. **Grouping**: Organize related items into meaningful categories
2. **Gradual complexity**: Start with familiar/simple items, progressively move to complex ones

**Examples**:
- **Recommended order**: Name → Home information → Company information
- **Avoid**: Mixed duplication of addresses and phone numbers increases user cognitive load

---

### 41. Create Flow

**Concept**: Use visual gestalt grouping and story-structured item placement to guide user gaze and operations.

**Key Points**:
1. **Visual gestalt usage**: Guide user gaze through grouping
2. **Story-structured placement**: Create natural flow through item sequence
3. **Button gravity concept**: Action buttons indicate flow endpoints
4. **Gaze and operation relationship**: Clarify paths users should follow

**Example**: Facebook login page implements grouping by background color, item sequence, visual flow, and action signifiers.

---

### 42. Good Defaults

**Concept**: Providing appropriate default values for selection-type input fields and settings reduces user operational and psychological burden.

**Good Default Value Characteristics**:
- Minimal user risk
- More common options
- More neutral options
- Reflecting current state
- Reflecting user operation history

**Examples**: iOS Display & Brightness settings screen and Photoshop Canvas Size dialog.

---

### 43. Constrained Controls

**Concept**: When input content has restrictions, use constrained control elements (radio buttons, dropdowns, steppers, sliders, pickers) rather than free text input.

**Application Scenarios**:
- Selecting predefined items
- Numeric input
- Date input

**Purpose**: Enable only valid values to be input, maintaining data integrity and preventing user errors.

---

### 44. Positive Wording

**Concept**: Make option wording as positive as possible.

**Important Principle**: Using negative labels in controls like radio buttons or checkboxes creates double negatives ("affirming a negation"), making them difficult for users to understand.

**Examples**:
- **Avoid**: "Don't use paid express trains other than Shinkansen" "Don't use air travel"
- **Recommended**: "Shinkansen" "Paid express train" "Airplane"

---

### 45. Results Over Values

**Concept**: Users generally prefer choosing from options over inputting themselves. Instead of manual parameter value input, visually present obtainable results for selection.

**Example**: Comparing Photoshop features: Color Variations function (displaying result thumbnails for selection) versus Color Balance function (requesting numeric input).

---

### 46. Structure Input Controls

**Concept**: Segment or constrain input fields according to the required value format.

**Comparing Four Implementation Methods**:
1. **Simple text box**: High cognitive load, error-prone. Suited for keyboard-proficient users' continuous input or copy-paste
2. **Segmented text boxes**: Input format visually suggested, low cognitive load. Keyboard operation mandatory
3. **Constrained controls**: Advantage of allowing only valid values. Counterproductive when many options exist
4. **Dedicated pickers**: Possible visual and clear presentation. Effectiveness varies by usage scenario

**Critical Design Principle**: Context-dependent approach is essential. Comprehensive consideration of information nature and usage scenario is necessary.

---

### 47. Specific Verbs

**Concept**: Use specific verbs indicating executed actions for primary button labels in modal dialogs and form screens, not "OK" or "Yes."

**Recommended Practice**:
- Use specific verbs indicating executed actions for primary buttons (e.g., "Save" "Delete")
- Use generic "Cancel" for cancel buttons

**Additional Guidance**: When contextual misunderstanding is possible, use more descriptive expressions to clarify actions.

---

### 48. Radio vs Checkbox

**English**: Radio Buttons vs Checkboxes

**Concept**: Radio buttons for single selection from options; checkboxes for independent on/off items.

**Radio Button Usage**:
- Single selection from options
- Applied when choosing one from multiple options like "A or B"
- Default value required

**Checkbox Usage**:
- Functions as independent on/off item
- Used for true/false judgment
- Also applicable when multiple selections needed

---

## Interaction (49-62)

### 49. Avoid Flip-Flop

**Concept**: When a single button toggles on and off, it's unclear whether the label represents the current state or the post-click state—this is the flip-flop problem.

**Solution**: Separate state expression from labels to avoid this problem.

**Key Points**:
- UX challenge in toggle buttons
- Necessity to eliminate button label ambiguity
- Design approach to prevent user confusion

---

### 50. Don't Require Accuracy

**Concept**: Minimize input format restrictions based on system convenience. Absorb input format variations (half-width vs full-width, hiragana vs katakana, hyphen presence) on the system side, automatically formatting/completing internally.

**Key Points**:
- Don't require mechanical precision from users
- System performs automatic formatting and completion
- Flexibility needed to accommodate input format variations

**Example**: Bad example showing card number input fields with "half-width numbers only" and "enter numbers only without hyphens."

---

### 51. Input Suggestions

**Concept**: Typing has high burden; users prefer choosing from options over inputting themselves. Present candidates when users have partially input text.

**Implementation Methods**:
- Conversion candidate suggestions
- Spell correction suggestions
- Search keyword suggestions
- Related item suggestions

**Purpose**: Show "what they were trying to input" or "valuable input values" as options, effectively supporting user work.

---

### 52. Avoid False Bottom

**Concept**: When screen bottom edge perfectly aligns with content break, users judge it as the endpoint and don't recognize scrollability. Adjust content break positions to suggest continuation.

**Example**: iPhone table views ensure row separators don't align with screen bottom edge.

**Implementation Techniques**:
- Intentionally display content elements incompletely
- Visually suggest scrollability
- Stimulate interest in next content

---

### 53. Option Previews

**Concept**: When changing object styles or selecting tools, present previews of resulting states as options.

**Key Points**:
- **Preview display effect**: If users can see results before applying properties, trial-and-error efficiency improves
- **UX enhancement**: Users can verify final state before deciding, reducing selection uncertainty

**Examples**: Font selection, print layout selection, brush selection, slide master selection.

---

### 54. Fail-Safe Over Fool-Proof

**English**: Fail-Safe, Rather Than Fool-Proof

**Concept**: Making it safe when mistakes happen (fail-safe) is more important than preventing mistakes (fool-proof).

**Key Point**: If all operations are reversible, user errors essentially become non-issues, making trial-and-error a meaningful process.

**Examples**: Representative fail-safe interfaces:
- Undo command
- History lists
- Browser back button

---

### 55. Constructive Error Messages

**Concept**: Error messages must accurately convey what happened and clearly indicate next steps to support user understanding and action.

**Avoid**: Programmer-oriented error numbers are useless to general users.

**Examples**:
- **Good**: Error content and solution method clearly stated
- **Bad**: Vague expressions like "fatal error occurred" with only technical error codes displayed

---

### 56. Probable vs Possible

**English**: Segregate Possible From Probable

**Concept**: Interface design should focus on "probability" not "possibility." Don't treat edge cases and common usage equally.

**Main Arguments**:
1. **Programmer vs designer perspective difference**: Programmers emphasize edge cases, designers should emphasize main cases
2. **Probabilistic thinking importance**: Features that don't occur frequently should be optionalized

**Example**: Confirmation like "Save?" obstructs normal usage. Making auto-save default is superior.

---

### 57. Do, Don't Ask

**Concept**: Don't constantly confirm what users are trying to do or report normal completion.

**Key Points**:
1. **Modeless feedback**: Convey operation status and processing results through screen changes, not dialog boxes
2. **Exception rule**: Pre-execution confirmation required only for irreversible operations risking data loss

**Example**: Modal dialog asking "Move these 2 items to trash?" is a design pattern to avoid.

---

### 58. Show Guts

**Concept**: Importance of trade-offs in design decision-making. Rather than trying to satisfy all requirements, prioritize clearly and have "the courage to make compromises."

**Key Points**:
- Design requires "guts to compromise specifications"
- Overprioritizing completeness or logic from fear of user misunderstanding or complaints results in information overload

**Example**: iOS spell correction applies automatic correction without explicit user selection. As a trade-off, it might produce unintended results, but prioritizes smooth input experience.

---

### 59. Wayfinding

**Concept**: Provide signposts so users don't get lost in information space.

**Four Core Questions**:
- Grasp current position
- Available destinations
- Surrounding environment awareness
- Means to return

**Implementation**: Adopting consistent navigation schemes (guidance systems) makes overall system structure comprehensible.

**Example**: iOS Health app clearly presents current location, destinations, surrounding information, and return means on screen.

---

### 60. Escape Hatch

**Concept**: When users get lost or want to interrupt work, make it easy to return to basic screens.

**Application Scenarios**:
- Navigation starting from home screen
- Scenarios entering specific modes for work

**Examples**:
- iPhone home button
- Mac System Preferences "Show All" button
- Keynote master edit mode done button

**Design Intent**: Provide reliable paths to safe locations (like home screen) even when users feel anxious or lost during work.

---

### 61. Instant Gratification

**Concept**: Design so users can feel success within seconds of starting to use the product.

**Core Points**:
- **Early-stage success experience**: Feel success within seconds
- **Immediate basic operation provision**: Display basic work screens or target object lists as early as possible
- **Progress realization**: Make users feel work is progressing legitimately

**Example**: Contrasting drawing apps that let you start drawing immediately after launch versus those first prompting registration or settings.

---

### 62. Deferred Choices

**Concept**: Don't demand all decisions from users upfront; allow deferring responses except for bare minimum.

**Specific Implementation Examples**:
- Minimize mandatory input items during account creation
- Enable record creation without completely filling attribute information
- Allow some service usage without accounts
- Make only obviously necessary items mandatory in input forms

---

## Visual Feedback (63-72)

### 63. Animate Transitions

**Concept**: Add transition animations to major screen changes so users can understand state transition continuity.

**Recommended Implementation**: Displaying intermediate processes between before and after changes in short 0.1-0.5 second intervals is critical. This staged visual representation makes screen transitions feel natural rather than abrupt.

---

### 64. Bidirectional Transitions

**Concept**: When adding transition animation from screen state A to state B, also add the reverse motion when returning from state B to state A.

**Key Point**: Implementing bidirectional transitions makes navigation experience consistent and helps users intuitively grasp relationships between screens.

---

### 65. 0.1 Second Response

**English**: Response In 0.1 Sec

**Concept**: The limit for systems to feel "instantaneous" is 0.1 seconds.

**Three Critical Time Limits**:
1. **0.1 seconds**: Limit for systems feeling "instantaneous"
2. **1 second**: Limit where user thought flow isn't interrupted
3. **10 seconds**: Maximum time users can concentrate on waiting. Processing exceeding this needs progress percentage or remaining time display

**Implementation Meaning**: Designers should aim for responses within 0.1 seconds, but when technically impossible, provide some feedback (loading display, etc.) within 1 second.

---

### 66. Feedback Near Operation

**Concept**: When systems indicate state changes, display feedback near where users are looking.

**Specific Implementation Methods**:
- For actions on selected objects, express through the object's own changes
- For standalone buttons, display feedback near the button

---

### 67. Progressive Disclosure

**Concept**: Initially hide advanced features so beginners can easily start using, then display additional UI when needed or when they can handle it.

**Main Benefit**: This approach enables gradual learning.

**Examples**: Print dialogs, property panels, image editing features.

---

### 68. Culturally Independent Icons

**English**: Culturally Independent Icon Motifs

**Concept**: Carefully avoid using signs or language-dependent idiomatic expressions from specific cultures in international services.

**Examples**:
1. **Stop Loading**: Red octagonal road signs don't have same meaning in all countries
2. **Post Mail**: Blue mailboxes aren't universally recognized
3. **App Launcher**: Rocket "launch" and app "launch" aren't the same word in all languages

---

### 69. Multilingual Label Length

**English**: Consider Label Length For Multilingualization

**Concept**: Average word character counts differ by language. Generally German is longer (1.4x English on average) so it's useful for simple layout flexibility testing.

**Key Points**:
1. **Character count differences by language**: Same-meaning words have different lengths in each language
2. **German characteristics**: About 1.4x English length, useful for layout validation
3. **East Asian language considerations**: Chinese and Hangul make labels shorter, requiring care not to impair button usability

**Example**: "Cancel" and "Save" button labels displayed in multiple languages show Korean at about 0.75x, German at about 1.5x length.

---

### 70. Avoid Cultural Symbols

**English**: Don't Use ◯ / ✕ / △ Symbols Without Care

**Concept**: Meanings differ by culture, so using in international interfaces risks unintelligibility.

**Key Points**:
- Japan uses ◯ and ✕ to mean "good" and "bad" but this differs by culture
- ✕ is sometimes used with same positive nuance as checkmark

**Recent Trends**: Using ✓ (check) and ✕ (cross) to mean "good" and "bad" is becoming international de facto standard.

**Example**: PlayStation controller ◯ and ✕ buttons have reversed meanings between Japanese and English markets.

---

### 71. Idiomatic Over Intuitive

**Concept**: "Intuitive UI" is commonly used, but actually "idiomatic" design is often what's needed.

**Key Points**:
- Double-clicking to open files, pinching to zoom photos—these require initial teaching
- These operations aren't innate intuition but habits learned through experience

**Implementation Guidance**:
1. **Leverage known idioms**: Respect operation habits users already know
2. **Learnable design**: New operation methods should be naturally learnable and eventually become habitual

**Example**: iPhone pinch operation requires initial explanation but is quickly mastered after one experience, eventually becoming standard operating technique.

---

### 72. Platform Button Order

**English**: Follow Platform Button Order

**Concept**: Dialog affirmative/negative button ordering should follow platform-specific rules, prioritizing user habits over app-internal logic.

**Basic Principle**: Prioritize platform-specific conventions for dialog box button placement.

**Standard Approach**: Without clear guidelines, follow general practice of left-to-right progression with affirmative button on right.

**Language Exception**: Reverses in RTL (right-to-left) languages. In RTL languages like Arabic, button placement needs adjustment as left becomes the forward direction matching users' natural reading direction.

---

## Layout & Visual Design (73-86)

### 73. Fixed Menu Positions

**Concept**: Users "spatially memorize" target items within menus, so position relationship changes impede learning.

**Examples**:
- **Desirable (Photoshop)**: In toolbars, items selected from popup menus become buttons, but menu ordering is always preserved
- **Avoid (Microsoft Office 2003)**: Frequently-used items display at top with rest collapsed. This dynamic reordering changes item positions by situation, making user learning difficult

---

### 74. Single Element Highlight

**Concept**: When expressing highlighted items among multiple peer items, change only one visual component of that item, or add only one component.

**Key Points**:
1. **Minimize changes**: Modify only single visual element like background color or border color
2. **Avoid excessive changes**: Changing multiple elements simultaneously (shape and background color) makes it look like different category rather than highlight
3. **Two-item exception**: When only two items exist, express highlight by "adding one element" (like border) rather than element change
4. **Limit added elements**: Too many added elements make it look like different item type

---

### 75. Optical Illusions

**Concept**: Screen composition states can cause optical illusions resulting in unintended appearances.

**Specific Adjustment Examples**:
1. **Vertical position illusion**: Elements centered vertically appear lower, requiring upward micro-adjustment
2. **Shape-based size illusion**: Same dimensions appear different sizes by shape, requiring visual adjustment
3. **Color perception changes**: Color appearance greatly influenced by area differences and surrounding color/density, making same colors appear different or different colors appear same

**Practical Method**: Know various illusion patterns and adjust based on visual assessment when necessary.

---

### 76. Spatial Memory

**Concept**: Let users place objects at arbitrary positions in 2D space and memorize those positions.

**Examples**:
- Application placement on springboard
- File positions on desktop
- Window and floating palette positions
- Toolbar items and color swatch arrangements

**System Responsibility**: System saves position information and recreates it on next launch. Don't arbitrarily change based on system convenience.

**Effect**: Users can leverage spatial memory, making interface interaction more natural and efficient.

---

### 77. Prospective Memory

**Concept**: Let users leave cues for their future selves.

**Specific Implementation Methods**:
- Bookmark functionality: Save content for later reference
- Flagging: Mark important items
- Window retention: Maintain open state
- Virtual sticky notes/markers: Visual indicators
- Draft saving: Save work in progress

**Example**: iPhone Safari browser share menu provides multiple save options (add to Textwell, bookmark, reading list, add to home screen).

---

### 78. 7mm Touch Target

**Concept**: Recommend making buttons and various UI control sizes 7-10mm square or larger for comfortable finger pressing.

**Key Points**:
- Ensure spacing between touch target elements to prevent mistaps
- Same logical size (pt) has different actual display sizes across devices due to varying screen resolutions
- Actual device operability verification important
- OSes like iOS automatically expand touch detection area, making ~5mm buttons practical when surrounded by whitespace

**Example**: iPhone X standard navigation bar height is approximately 8mm.

---

### 79. Direct Gesture Manipulation

**English**: Gesture For Direct Manipulation

**Concept**: Screen reactions to gestures should have target elements directly follow the series of input motions.

**Key Point**: Arbitrary correspondence between motion and meaning makes learning difficult. Design where users can intuitively understand relationship between actions and results is important.

**Example**: iOS list deletion feature:
- **After improvement**: User swipes row left, row itself follows finger sliding, delete button gradually appears
- **Before improvement**: Same gesture but delete button appeared suddenly

**Exception**: In games, command-style gestures are acceptable when "recreating the motion itself is part of gameplay."

---

### 80. Top-Bottom, Left-Right Drilldown

**Concept**: When dividing screen into multiple panes, apply these rules.

**Main Principles**:
- **Vertical relationship**: Details of items selected at top display below
- **Horizontal relationship**: Details of items selected on left display on right

**Important Note**: Reverse horizontal relationship for RTL languages (like Arabic).

**Smartphone Exception**: When considering coexistence with headers on narrow screens, deviations from standard rules are sometimes acceptable.

---

### 81. Left Goes Back, Right Forward

**Concept**: Associate left with back (past) and right with forward (future).

**Basic Principle**: Unify directionality on horizontal axis.

**Important Note**: For RTL languages (right-to-left languages like Arabic), completely reverse this left-right relationship.

**Design Significance**: This guideline promotes intuitive user understanding. Making time axis and progression direction visually consistent reduces cognitive load and enhances navigation experience.

---

### 82. Hierarchical for Mobile

**English**: Hierarchical Rather Than Comprehensive For Mobile

**Concept**: While comprehensive workspace display is appropriate for desktop, limiting information shown at once and structuring hierarchically is important for mobile.

**Key Points**:
- Multi-function systems require judging whether to "display many options at once reducing hierarchy" or "narrow options increasing hierarchy"
- Mobile adopts the latter, limiting each screen's role keeping it simple
- Increasing hierarchy prevents users from losing current position even on small screens

**Example**: iPhone Photos app doesn't display all features on one screen like Mac iPhoto, instead separating album list, photo thumbnails, and enlarged display into separate screens.

---

### 83. Keep Simple Things Simple

**Concept**: As products mature and gain features, general simple functions can get buried in advanced features. Even in mature products, basic operations should remain concise.

**Key Points**:
- Operations easy in early stages shouldn't become complex
- Necessity to continuously maintain simple operations
- Don't compromise basic feature usability when adding advanced features

**Related Guidelines**: Simplicity, progressive disclosure, few colors and fonts, less customization.

---

### 84. Few Colors and Fonts

**Concept**: While color schemes and typefaces can emphasize specific elements or represent information groups, too many types clutters screens.

**Key Points**:
- Colors and typefaces effective for emphasis and information classification
- However, avoid excessive use
- Purpose is screen organization and visibility maintenance

---

### 85. Layout Tidily

**Concept**: Arrange screen elements orderly along grids. Give whitespace and alignment repetitiveness and consistency.

**Purposes**:
- Create visual stability
- Logically display information structure
- Clarify area containment relationships
- Ensure shape continuity

**Practical Meaning**: This principle makes on-screen information intuitively understandable to users. Grid-system-based placement and consistent whitespace management create design orderliness, improving user experience.

---

### 86. Less Customization

**English**: Less Preferences

**Concept**: Avoid excessive customization features in systems just because user needs are diverse.

**Main Argument**: Relying on customization to address slightly different requirements per user actually makes systems more complex, reducing learnability and maintainability.

**Recommended Approach**:
- Decide optimal UI specifications initially
- Provide customization features cautiously and sparingly

**Example**: MS Word settings screenshot cited as example showing excessive customization complexity.

---

## User Experience & Accessibility (87-100)

### 87. User's Tool

**English**: It Should Belong To The User

**Concept**: Build systems as belonging to users, not providers.

**Central Argument**: Designers should adopt user-centered rather than provider-centered perspectives. Understanding system's role is key:
- Not means to force users, but tools users use to achieve goals
- Mechanism for users to execute something (user-driven, not sales-driven)

**Example**: Using e-commerce sites as example, explains importance of "designing as mechanism for buying, not selling." Unnecessary ad options enabled by default result from provider-perspective design.

---

### 88. User's Own Method

**Concept**: Understand difference between manual-less and modeless. Manual-less means "procedures are easy to remember" while modeless means "procedures aren't fixed."

**Main Points**:
- Excellent systems like iPhone feel "usable without manual" not just because procedures are simple, but because usage methods aren't fixed in the first place
- Excellent GUI is based on principles of "modelessness, direct manipulation, consistency"
- Design's role is enabling users to learn efficiently and devise their own usage methods

**Important Note**: People forget this because learning efficiency is good. iPhone also requires prerequisite knowledge.

---

### 89. Let Users Learn

**English**: Let Users Learn, Don't Educate

**Concept**: Systems must be usable by users with domain experience without assistance.

**Key Points**:
- **Eliminate operation explanations**: Don't include operation instructions in interface
- **Self-explanatory design**: Interface itself must clarify how to use
- **Ensure learnability**: Design where users can intuitively understand usage methods

**Example**: Comparing "Sales Report" button versus "Click here to download sales report" link. Former is self-explanatory, latter relies on explanation.

---

### 90. Don't Lock UI

**Concept**: When UI locks for several seconds or more, users lose the sense of freely controlling the application.

**Basic Processing Flow**: GUI operation progresses in cycles of user action → program processing → result display.

**Implementation Approach**: For heavy processing, minimize UI lock states through implementation techniques like asynchronization and parallelization.

**Example**: In macOS, when applications lock UI for certain time (about 3 seconds), OS automatically changes mouse pointer to waiting cursor.

---

### 91. Don't Bring Games

**Concept**: Users want "goal achievement," not game-like qualities outside game apps.

**Elements Not to Incorporate in Interfaces**:
- Randomness or unexpectedness
- Gambling elements
- Speed requirements for judgment/operation
- Complexity
- Dexterity requirements
- Intuition requirements

**Example**: Don't make users "treasure hunt" where important information or features can only be discovered through mouseover.

---

### 92. Move As User Wants

**Concept**: Interfaces should responsively move to user operations, but actually shouldn't reflect input values as-is—important to incorporate appropriate "play" and experience-based "correction."

**Examples**:
1. **Hierarchical menus**: When mouse moves over parent items, provide certain time allowance so diagonal movement doesn't prematurely close child hierarchy
2. **Mouse pointer**: Mouse acceleration feature where slow movement yields short distance, fast movement yields large distance
3. **iPhone touch correction**: Applies correction to actual touch coordinates, increasing upward correction toward screen top

---

### 93. Expand Hotspots

**Concept**: Make tap/click areas wider than displayed rectangles. This technique achieves both visual balance and operability.

**Important Constraint**: Separation between target element and hotspot is prohibited. Tappable area must maintain unity with visually recognizable element.

**Example**: In iOS screen keyboard, key response areas dynamically change according to word being typed. For example when typing "WORLD," after typing "WORL," the next character "D" becomes highly probable, so that key's response area automatically expands (based on iOS 6 research).

---

### 94. Screen Reader Support

**Concept**: Provide alternative text for images and other non-text information.

**Purpose**: Support users utilizing screen readers or voice browsers. Ensure voice device compatibility.

**Implementation Methods**:
- Follow platform standard specifications
- Specify alternative text in iOS app source code
- Implement same specifications in web page HTML

**Effect**: Accessibility improvement provides content to more users.

---

### 95. Text Enlargement Support

**Concept**: Support platform and browser text enlargement features. Implement text display following standard specifications, enhancing accessibility.

**Implementation Points**:
- Support functionality letting users enlarge display size
- Implementation conforming to platform standard specifications
- Support for both web pages and mobile apps

---

### 96. Avoid Color Dependence

**English**: Avoid Reliance On Color

**Concept**: Don't make interfaces dependent on color expression. Make information conveyable without color.

**Recommended Implementation Methods**:
- **Leverage contrast**: Improve visibility through light-dark differences
- **Visual auxiliary elements**: Decorations like borders and underlines
- **Spatial design**: Mapping through shapes and positional relationships
- **Text supplementation**: Additional text explanations of information

**Validation Method**: Testing by displaying interface in grayscale is effective.

---

### 97. User's Own Pace

**English**: Allow Users To Work At Their Own Pace

**Concept**: Emphasize these four important elements in user interface design.

**Four Important Elements**:
1. **No time limits**: Avoid timeout restrictions on operations
2. **Eliminate timing dependency**: Avoid operation validity changes due to time passage
3. **Don't require reflexes**: Design not demanding instantaneous response from users
4. **Emphasize control**: Users seek control, not challenges (excluding games)

**Example**: Error message "Session timed out. Content being entered was lost" is a design pattern to avoid.

---

### 98. User Illusion

**Concept**: Computers leverage processing capacity and speed to hide complex internal structures while realizing virtual environments where users can concentrate on work.

**Definition and Concept**: Mechanisms providing natural illusions like infinite-capacity folders and instantly-delivered emails.

**Example**: Processing calculation differences don't always affect user experience. For example, if brush tool requires 100x more calculation than pencil tool but both complete in 0.1 vs 0.001 seconds, users perceive no difference.

**Design Philosophy**: UI design can proceed from perspective of "how that world should be for users" regardless of computational load. This creates modern software's freedom.

**Alan Kay Quote**: Recognition that "what users can perceive is the computer for that user" elevated UI to most critical element.

---

### 99. Design Proposes Meaning

**English**: Design Proposes A New Meaning

**Concept**: Innovative design isn't mere problem-solving but guides new ways of perceiving things.

**Main Theme**: Essence is enabling users to experience the world differently through designers' internal contemplation.

**Specific Cases**:
1. **Walkman**: Brought new audio experience of listening to favorite music anywhere
2. **Wii**: Realized experience of enjoying video games while moving bodies in living room
3. **Google Maps Street View**: Brought experience of virtually visiting places worldwide, changing the meaning of maps itself

**Conclusion**: Innovative design, while based on user research and market analysis, essentially functions as proposing new meaning experiences.

---

### 100. Positive Human Impact

**English**: Positively Affect The Human Beings

**Concept**: Tool design isn't just for users' temporary goal achievement. Design should serve humanity and enrich life.

**Key Point**: Culture accumulates in design, and its inheritance is important.

**Examples**:
1. **Hammer**: Concentrates 3 million years of refinement since Paleolithic Era
2. **Chopsticks**: Just two sticks but possess tool-ness within culture
3. **Bicycle**: Makes humans the most movement-efficient animals on Earth
4. **Personal computers and Internet**: Liberated from physical constraints, brought new world recognition

---

## Summary

These guidelines are comprehensive human interface design principles that Sociomedia, Inc. compiled based on years of practical experience and literature research.

**Usage**:
- Reference for UI/UX design guidelines
- Use as design review checklist
- Share design principles within teams
- Use as evaluation criteria for new design patterns

**References**: For detailed explanations and related information on each item, visit the [Sociomedia official website](https://www.sociomedia.co.jp/category/shig).

---

Last updated: January 2026
