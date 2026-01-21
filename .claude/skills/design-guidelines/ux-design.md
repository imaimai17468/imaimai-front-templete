# UX Design Guidelines

This skill guides the design of intuitive human interfaces that feel natural and effortless. Apply these principles when making UX decisions, designing flows, or evaluating existing interfaces.

The user provides UX requirements: a feature, flow, interaction pattern, or interface behavior to design. They may include context about user needs, business goals, or technical constraints.

---

## Design Thinking

Before designing any interface, understand the cognitive context:

- **Mental Model**: How do users imagine this system works? Match their expectations, not your implementation.
- **Task Flow**: What are users trying to accomplish? Optimize for their goals, not your features.
- **Cognitive Budget**: Users have limited attention and energy. Every element costs mental effort.
- **Context**: Where, when, and how will this be used? Design for real conditions.

**CRITICAL**: The best interface is invisible. Users should accomplish goals without thinking about the tool itself.

---

## Core Principles

Design interfaces where users feel in control and actions feel natural.

### Objects, Not Procedures

Let users manipulate things directly. Don't force them through rigid step-by-step wizards. Extract the objects users care about and make them interactive.

```tsx
// ✅ Good: Direct object manipulation
<FileList>
  {files.map(file => (
    <File
      key={file.id}
      draggable
      onDelete={() => deleteFile(file.id)}
      onRename={(name) => renameFile(file.id, name)}
    />
  ))}
</FileList>

// ❌ Bad: Rigid wizard forcing specific order
<Wizard>
  <Step1>Select files</Step1>
  <Step2>Choose action</Step2>
  <Step3>Confirm</Step3>
</Wizard>
```

### Modeless and Reversible

Avoid modes where the same action means different things. Every action should be undoable. Users should work in any order they choose.

```tsx
// ✅ Good: Always reversible
<Editor>
  <UndoButton onClick={undo} />
  <RedoButton onClick={redo} />
</Editor>

// ❌ Bad: Irreversible without warning
<DeleteButton onClick={() => deleteItem()} />
```

### Immediate Feedback (Doherty Threshold)

Respond to every action within 400ms. Silence feels broken. Show progress, confirm success, explain errors instantly.

```tsx
// ✅ Good: Instant feedback
function SearchComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: fetchSearch,
    staleTime: 5000
  });

  if (isLoading) return <Skeleton />;
  return <SearchResults results={data} />;
}
```

### Smart Defaults

Do the calculation for users. Offer optimal presets. Remember their preferences. Reduce decisions wherever possible—decision fatigue degrades everything.

```tsx
// ✅ Good: Smart defaults
<Select defaultValue="recommended">
  <option value="basic">Basic</option>
  <option value="recommended">Standard (Recommended)</option>
  <option value="premium">Premium</option>
</Select>
```

### Progressive Disclosure

Show basics first, details on demand. Don't overwhelm with everything at once, but don't hide things users need.

```tsx
// ✅ Good: Progressive disclosure
<Form>
  <BasicFields />
  <Accordion title="Advanced Settings (Optional)">
    <AdvancedFields />
  </Accordion>
</Form>
```

### Prevent, Don't Report

Design to make errors impossible before they happen. Constraints and smart defaults beat error messages every time.

```tsx
// ✅ Good: Prevention through confirmation
function handleDelete() {
  confirmDialog({
    title: "Are you sure you want to delete?",
    description: "This action cannot be undone",
    onConfirm: () => deleteItem()
  });
}
```

---

## Visual Communication

Visual communication must be crystal clear.

### Signifiers

Clickable things must look clickable. Disabled things must look disabled. Never make users guess what's interactive.

### Visual Hierarchy

Size, color, contrast, and position guide the eye. Most important = most prominent. First and last items are remembered best (serial position effect).

```tsx
// ✅ Good: Clear hierarchy
<div className="flex gap-2">
  <Button variant="primary" size="lg">Purchase</Button>
  <Button variant="ghost" size="sm">View Details</Button>
</div>
```

### Gestalt Grouping

Proximity, similarity, and closure show relationships. Users see patterns before they read labels.

### Consistency

Same meaning = same appearance. Different meaning = different appearance. Consistency is how users learn your system.

---

## UX Psychology

> **Reference**: [Shokasonjuku Inc. - UX Psychology](https://www.shokasonjuku.com/ux-psychology)

Leverage cognitive biases and effects to create better experiences. Each principle includes definitions, application strategies, and code examples.

### Perception & Cognition

#### Aesthetic-Usability Effect

**Definition**: The phenomenon where beautifully designed products or interfaces are perceived as more usable than those that are not.

**Application**:
- Enhance the visual quality of interfaces
- Optimize balance of color, typography, and whitespace
- Aim for harmony between aesthetics and actual functionality

**Implementation**:
```tsx
// ✅ Good: Visually refined component
<Button
  variant="primary"
  size="md"
  className="shadow-sm hover:shadow-md transition-all"
>
  Execute Action
</Button>
```

**Important Notes**: Beauty alone is insufficient. Actual functionality is equally important. Never sacrifice accessibility.

---

#### Cognitive Load

**Definition**: The amount of mental energy required for users to process and understand information.

**Application**:
- Present information progressively (Progressive Disclosure)
- Limit choices and provide default values
- Break complex operations into multiple steps

**Implementation**:
```tsx
// ✅ Good: Display information progressively
function Wizard() {
  return (
    <Steps currentStep={currentStep}>
      <Step1 />  {/* Basic information only */}
      <Step2 />  {/* Detailed settings */}
      <Step3 />  {/* Confirmation */}
    </Steps>
  );
}
```

**Important Notes**: Balance between simplicity and functionality is crucial. Avoid hiding too much information.

---

#### Banner Blindness

**Definition**: The phenomenon where users unconsciously ignore banner advertisements on websites.

**Application**:
- Avoid ad-like positions and styles for important information
- Place CTAs in natural content flow
- Utilize native advertising techniques

**Implementation**:
```tsx
// ✅ Good: CTA integrated into content
<article>
  <p>Article content...</p>
  <InlineCallToAction>Proceed to Next Step</InlineCallToAction>
</article>
```

---

#### Selective Attention

**Definition**: Users' tendency to focus on information aligned with their goals while ignoring irrelevant stimuli.

**Application**:
- Make important elements visually prominent
- Reduce unnecessary distracting elements
- Clarify visual hierarchy

**Implementation**:
```tsx
// ✅ Good: Emphasize primary action
<div className="flex gap-2">
  <Button variant="primary" size="lg">Purchase</Button>
  <Button variant="ghost" size="sm">View Details</Button>
</div>
```

---

### Decision Making & Judgment

#### Anchor Effect

**Definition**: Users' tendency to evaluate subsequent information based on previously presented information.

**Application**:
- Present reference prices in pricing
- Set default values strategically
- Display comparison targets explicitly

**Implementation**:
```tsx
// ✅ Good: Utilize price anchoring
<PricingCard>
  <OriginalPrice className="line-through text-gray-400">$100</OriginalPrice>
  <CurrentPrice className="text-2xl font-bold">$70</CurrentPrice>
  <Discount>30% OFF</Discount>
</PricingCard>
```

**Important Notes**: Avoid unfairly distorting user judgment. False reference prices damage trust.

---

#### Confirmation Bias

**Definition**: The phenomenon where people preferentially accept information that aligns with their existing beliefs.

**Application**:
- Personalize content based on users' existing beliefs
- Present diverse perspectives for balance
- Design experiences that meet user expectations

**Important Notes**: Avoid echo chamber effects. Present information from different perspectives in a balanced way.

---

#### Framing Effect

**Definition**: A psychological phenomenon where judgment is influenced by how information is presented or worded.

**Application**:
- Choose between positive framing (gains) and negative framing (losses)
- Design messaging strategically
- Optimize CTA copy

**Implementation**:
```tsx
// Positive framing (introducing new features)
<Message>New features improve work efficiency by 50%</Message>

// Negative framing (prompting action)
<Alert>Failure to backup now may result in data loss</Alert>
```

**Important Notes**: Accurate expression is necessary to avoid misunderstanding or distrust. Excessive fear appeals are counterproductive.

---

#### Decision Fatigue

**Definition**: The phenomenon where making repeated decisions makes rational choices difficult for users.

**Application**:
- Minimize decision points
- Set smart default values
- Limit choices to approximately 3-5 options

**Implementation**:
```tsx
// ✅ Good: Reduce decisions with default values
<Select defaultValue="recommended">
  <option value="basic">Basic</option>
  <option value="recommended">Standard (Recommended)</option>
  <option value="premium">Premium</option>
</Select>
```

---

#### Decoy Effect

**Definition**: A persuasion technique where introducing a decoy option makes other options appear more attractive.

**Application**: Make middle pricing plan stand out. Arrange choices for easy comparison.

**Implementation**:
```tsx
<PricingTiers>
  <Tier name="Basic" price="$10" />
  <Tier name="Standard" price="$30" recommended />
  <Tier name="Premium" price="$100" />  {/* Decoy */}
</PricingTiers>
```

**Important Notes**: Ethical considerations are necessary. Do not deceive users.

---

#### Default Bias

**Definition**: People's tendency to stick with presented default values.

**Application**: Default settings that prioritize user benefit. Strategic design of opt-in/opt-out.

**Implementation**:
```tsx
// ✅ Good: Prioritize user benefit
<Checkbox defaultChecked={true}>
  Receive important security updates
</Checkbox>
<Checkbox defaultChecked={false}>
  Receive marketing emails
</Checkbox>
```

---

#### Loss Aversion

**Definition**: Users' tendency to avoid potential losses. Losses have greater psychological impact than gains.

**Application**:
- Use loss framing in messaging (carefully)
- Clarify what will be lost during deletion or cancellation
- Reminders before trial expiration

**Implementation**:
```tsx
// ✅ Good: Clarify what will be lost
<CancelSubscriptionDialog>
  <Warning>
    Canceling will result in loss of:
    <ul>
      <li>100GB storage</li>
      <li>Access to premium features</li>
      <li>Priority support</li>
    </ul>
  </Warning>
</CancelSubscriptionDialog>
```

**Important Notes**: Excessive sense of crisis causes backlash. Provide honest and transparent information.

---

### Memory & Learning

#### Serial Position Effect

**Definition**: The phenomenon where the first and last items in a list are remembered better than middle items.

**Application**:
- Place important information at the beginning and end of lists
- Navigation menu placement strategy
- Form field order design

**Implementation**:
```tsx
// ✅ Good: Important items at beginning and end
<Menu>
  <MenuItem>Home</MenuItem>  {/* Important */}
  <MenuItem>Products</MenuItem>
  <MenuItem>Blog</MenuItem>
  <MenuItem>Support</MenuItem>
  <MenuItem>Contact</MenuItem>  {/* Important */}
</Menu>
```

---

#### Zeigarnik Effect

**Definition**: The phenomenon where incomplete tasks remain in memory better than completed tasks.

**Application**:
- Visualize progress with progress bars
- Encourage continuation with "Read more" or "Next episode"
- Display onboarding completion percentage

**Implementation**:
```tsx
// ✅ Good: Visualize progress to encourage continuation
<OnboardingProgress>
  <ProgressBar value={60} max={100} />
  <Text>Just 2 more steps to complete your profile!</Text>
</OnboardingProgress>
```

**Important Notes**: The satisfaction of resolution is equally important. Excessive incompleteness leads to stress.

---

#### Priming Effect

**Definition**: The phenomenon where previously received stimuli unconsciously influence subsequent actions.

**Application**:
- Use visuals and messages to prepare for next action
- Guide emotions with color schemes
- Form expectations with icons and images

**Implementation**:
```tsx
// ✅ Good: Visual priming
<ProductPage>
  <HeroImage src="/luxury-product.jpg" />  {/* Evoke luxury */}
  <Price>$500</Price>  {/* Primed price perception */}
</ProductPage>
```

**Important Notes**: Aim for natural flow to avoid appearing manipulative.

---

#### Familiarity Bias

**Definition**: People's tendency to feel comfortable with designs or features they've previously experienced.

**Application**:
- Utilize known UI patterns (e.g., hamburger menu)
- Follow platform design guidelines
- Balance innovation with familiarity

**Implementation**:
```tsx
// ✅ Good: Utilize known patterns
<SearchBar>
  <MagnifyingGlassIcon />  {/* Common search icon */}
  <Input placeholder="Search..." />
</SearchBar>
```

---

### Motivation & Engagement

#### Gamification

**Definition**: An approach that incorporates game elements to enhance user motivation.

**Application**:
- Points, badges, and ranking systems
- Milestones that provide sense of achievement
- Setting challenges or quests

**Implementation**:
```tsx
// ✅ Good: Moderate gamification
<UserProfile>
  <AchievementBadges>
    <Badge icon="🏆" label="First Post" unlocked />
    <Badge icon="⭐" label="10 Articles Published" unlocked />
    <Badge icon="🎯" label="100 Likes Achieved" locked />
  </AchievementBadges>
</UserProfile>
```

**Important Notes**: Ensure game elements don't obstruct primary purpose. Not all users prefer gamification.

---

#### Goal Gradient Effect

**Definition**: A psychological phenomenon where users accelerate their actions and efforts as they approach a goal.

**Application**:
- Visualize progress with progress bars
- Set milestones
- Increase rewards as completion approaches

**Implementation**:
```tsx
// ✅ Good: Visual progress display
<LoyaltyProgram>
  <ProgressBar value={8} max={10} />
  <Text>Just 2 more purchases to become Gold Member!</Text>
</LoyaltyProgram>
```

---

#### Variable Reward

**Definition**: A reward system where the size or frequency of rewards is unpredictable, heightening interest.

**Application**: Random rewards or surprise elements. Gacha or lottery mechanics. Irregular special offers.

**Important Notes**: Can lead to dependency; ethical considerations are crucial. Exercise caution with high-gambling mechanics.

---

#### Curiosity Gap

**Definition**: A UX technique where users become interested and take action to fill an information gap.

**Application**:
- Content design that reveals information progressively
- Utilize previews or teasers
- "Read more" or "Show more" links

**Implementation**:
```tsx
// ✅ Good: Moderate information disclosure
<ArticleCard>
  <Title>5 Secrets of UI Design</Title>
  <Preview>What unexpected techniques do professional designers use...</Preview>
  <ReadMore>Read More →</ReadMore>
</ArticleCard>
```

**Important Notes**: Deceiving users damages trust. Avoid clickbait.

---

#### User Delight

**Definition**: Moments of joy or surprise felt when using a product.

**Application**:
- Unexpected positive micro-interactions
- Animations or sound effects
- Easter eggs or hidden elements

**Implementation**:
```tsx
// ✅ Good: Subtle delightful touches
<LikeButton onClick={handleLike}>
  <HeartIcon
    className="transition-all hover:scale-110"
    animate={liked ? "bounce" : "none"}
  />
  {likeCount > 10 && <Confetti />}  {/* Surprise */}
</LikeButton>
```

**Important Notes**: Too much surprise can compromise usability. Ensure no performance impact.

---

### Social Influence

#### Social Proof

**Definition**: A psychological phenomenon where people are influenced by others' opinions or actions.

**Application**:
- Display reviews and ratings
- Show number of users or popularity
- Display "Others also purchased"

**Implementation**:
```tsx
// ✅ Good: Utilize social proof
<ProductCard>
  <Rating value={4.5} count={1234} />
  <SocialProof>Over 10,000 purchases</SocialProof>
  <Reviews>
    <Review author="Tanaka">Very satisfied!</Review>
  </Reviews>
</ProductCard>
```

**Important Notes**: Fake reviews damage brand. Ensure transparency and credibility.

---

#### Halo Effect

**Definition**: The phenomenon where a company's positive image influences overall brand evaluation.

**Application**: Reflect corporate image and CSR activities in design. Maintain brand consistency. Display trustworthy partnerships.

**Important Notes**: Gap between image and reality leads to trust loss.

---

#### Endowment Effect

**Definition**: The tendency to overvalue things one owns regardless of market value.

**Application**:
- Foster sense of ownership through trial periods or freemium models
- Provide customizable elements
- Labels indicating ownership like "My [X]"

**Implementation**:
```tsx
// ✅ Good: Foster sense of ownership
<UserDashboard>
  <Header>Your Dashboard</Header>
  <CustomWidgets>
    {/* User-customized widgets */}
  </CustomWidgets>
</UserDashboard>
```

**Important Notes**: Exploiting resistance during cancellation causes trust loss.

---

### Design Patterns

#### Intentional Friction

**Definition**: A design technique that intentionally adds steps to delay user actions.

**Application**:
- Add confirmation steps for critical decisions (deletion, purchase, etc.)
- Two-step verification to prevent mistakes
- Cooling-off period settings

**Implementation**:
```tsx
// ✅ Good: Confirmation step for critical operations
<DeleteButton onClick={handleDelete}>Delete</DeleteButton>

function handleDelete() {
  confirmDialog({
    title: "Are you sure you want to delete?",
    description: "This action cannot be undone",
    confirmText: "Delete",
    onConfirm: () => deleteItem()
  });
}
```

**Important Notes**: Excessive friction leads to user abandonment. Appropriate balance based on importance.

---

#### Visual Anchor

**Definition**: A design principle that attracts user attention to specific elements through visual emphasis.

**Application**: Emphasize CTA buttons with accent colors. Highlight important information. Draw attention with animations.

**Implementation**:
```tsx
// ✅ Good: Utilize visual anchors
<Hero>
  <Title>Introducing Our New Product</Title>
  <Description>Innovative features boost productivity</Description>
  <CTAButton variant="primary" size="lg" className="animate-pulse">
    Try Now
  </CTAButton>
</Hero>
```

**Important Notes**: Excessive emphasis appears cluttered. Consider accessibility with animations.

---

#### Skeuomorphism

**Definition**: A design technique where digital elements mimic the appearance of real-world objects.

**Application**: Utilize realistic representations to facilitate user understanding. Use for calendars, notepads, calculators, etc.

**Important Notes**: Excessive realism conflicts with modern design. Balance with flat design.

---

### Other Important Principles

#### Nudge Effect

**Definition**: A design technique that guides user decision-making effectively and non-coercively.

**Application**: Gently encourage behavior through default values, presentation order, and framing. Design choice architecture. Explicitly indicate recommended options.

**Implementation**:
```tsx
// ✅ Good: Utilize nudging
<SettingsForm>
  <Toggle
    label="Enable automatic backup (Recommended)"
    defaultChecked={true}
    hint="Ensures data safety"
  />
</SettingsForm>
```

**Important Notes**: Respect user free will. Transparent guidance.

---

#### Peak-End Rule

**Definition**: A law where people evaluate experiences based on the peak moment and how it ends.

**Application**: Focus on key points in user journey (beginning and end). Enhance completion screens and thank you pages.

**Implementation**:
```tsx
// ✅ Good: Memorable completion experience
<CompletionScreen>
  <SuccessAnimation />  {/* Peak experience */}
  <Congratulations>Congratulations!</Congratulations>
  <Summary>Your achievement: ...</Summary>
  <NextSteps>Try this next</NextSteps>
</CompletionScreen>
```

**Important Notes**: Overall experience cannot be ignored; balance is important.

---

#### Scarcity Effect

**Definition**: Consumer psychology where difficult-to-obtain products are perceived as more valuable.

**Application**: Enhance user purchase intent with limited availability or time restrictions. Display "Only a few left" or "Limited time."

**Implementation**:
```tsx
// ✅ Good: Moderate scarcity display
<ProductCard>
  <Badge variant="warning">Only 3 left</Badge>
  <Price>$50</Price>
  <Countdown endTime={saleEndTime} />
</ProductCard>
```

**Important Notes**: False scarcity displays damage trust. Ethical scarcity presentation.

---

#### Sunk Cost Effect

**Definition**: A psychological tendency to invest additional resources to justify past investments.

**Application**: Visualize user time investment (progress) to encourage continuation. Foster sense of investment after account creation.

**Important Notes**: Avoid overreinforcing irrational continuation behavior. Consider user's best interests.

---

#### Labor Illusion

**Definition**: The phenomenon where users perceive higher value when seeing the effort behind a service.

**Application**: Visualize processing to enhance value perception. Progress displays like "Analyzing [X] data items..."

**Implementation**:
```tsx
// ✅ Good: Visualize labor
<SearchResults>
  <LoadingState>
    <Spinner />
    <Steps>
      <Step completed>Searched 1,000 databases</Step>
      <Step active>Filtering most relevant results</Step>
      <Step>Optimizing rankings</Step>
    </Steps>
  </LoadingState>
</SearchResults>
```

**Important Notes**: Transparency and trust-building are important. Excessive演出 is counterproductive.

---

#### Expectation Bias

**Definition**: A psychological phenomenon where prior expectations or preconceptions influence evaluation of actual experiences.

**Application**: Communication that appropriately sets user expectations. Expectation adjustment during onboarding.

**Important Notes**: Providing experiences that exceed expectations is important. Excessive expectations lead to disappointment.

---

#### Foot in the Door Effect

**Definition**: The tendency to accept larger requests after accepting smaller ones.

**Application**: Gradually increase requests during onboarding. Start with simple tasks first.

**Important Notes**: Avoid making users feel manipulated.

---

#### Hawthorne Effect

**Definition**: People's tendency to change their behavior when aware they're being observed.

**Application**: Behavior improvement during user testing or feedback. Provide public activity records.

**Important Notes**: Recognize that test environments differ from real environments.

---

#### Reactance

**Definition**: Psychological resistance when users feel constrained or restricted.

**Application**: Avoid coercive demands and design to provide sense of freedom. Offer choices. Clearly indicate opt-out features.

**Important Notes**: Respecting user autonomy is important.

---

#### Empathy Gap

**Definition**: The phenomenon where designers cannot empathize with users' emotions or needs.

**Application**: Foster empathy through user research and persona development. Dialogue with actual users.

**Important Notes**: Regular user feedback collection is important.

---

## Anti-Patterns (Never Do This)

NEVER design interfaces that:

- ❌ Force rigid sequences when flexibility is possible
- ❌ Hide undo or make actions irreversible without warning
- ❌ Rely on user memory for information you could display
- ❌ Use jargon instead of user language
- ❌ Make users wait without feedback
- ❌ Trick users with dark patterns (fake scarcity, hidden costs, shame tactics)
- ❌ Ignore accessibility—everyone should be able to use the interface
- ❌ Assume you know users without testing with real people (empathy gap)

### Always Question

- "Does this match how users think about the problem?"
- "Can users immediately tell what to do and what's clickable?"
- "Are users in control, or is the system forcing them?"
- "Could this cause errors? Could we prevent them instead?"
- "Is this the simplest path to the goal?"
- "Does this respect user attention and reduce cognitive load?"
- "Would this work for users with different abilities and contexts?"

---

## Review Questions

When evaluating any interface decision, ask:

1. Does this match how users think about the problem?
2. Can users immediately tell what to do and what's clickable?
3. Are users in control, or is the system forcing them?
4. Could this cause errors? Could we prevent them instead?
5. Is this the simplest path to the goal?
6. Does this respect user attention and reduce cognitive load?
7. Would this work for users with different abilities and contexts?

---

## The Standard

Every interface should feel effortless and natural. Not dumbed down — *intuitive*. And designed for real human cognition.

**Goal**: Create interfaces where users accomplish their goals without thinking about the interface itself. When the tool becomes invisible, you've succeeded.

---

## Implementation Guidance

**IMPORTANT**: Apply psychology principles ethically. Use them to guide users toward outcomes that benefit them, not to manipulate or exploit. Transparency and user control should always be preserved.

1. **Ethical Application**: Never use psychology to deceive or manipulate users
2. **Balance Multiple Principles**: Consider how different effects interact
3. **Test with Real Users**: Validate assumptions through user research
4. **Prioritize Accessibility**: Ensure all users can benefit from good UX
5. **Maintain Transparency**: Be honest in all communications

Remember: Great UX feels like no UX at all. When users forget they're using software and just accomplish their goals, you've succeeded.

---

## 参考資料

- [松下村塾株式会社 - UX Psychology](https://www.shokasonjuku.com/ux-psychology)
