/**
 * All page copy lives here. In the Supabase build this maps to the
 * `site_content` singleton row that she edits from /admin.
 * Items marked TODO are placeholders awaiting the client's answers.
 */

export const brand = {
  name: 'Работилница',
  owner: 'Джейля',
  tagline: 'Работилници по керамика',
  shopUrl: 'https://edinpodarak.com/',
  instagram: 'https://www.instagram.com/djeilqart/',
  facebook: 'https://www.facebook.com/Djeilqart',
  email: 'djeilqart@gmail.com',
  phone: '+359893622801',
  phoneDisplay: '0893 622 801',
  city: 'Гоце Делчев',
  venue: 'ул. „Брегалница“ 3',
};

export const hero = {
  titleLead: 'Направи си',
  titleAccent: 'нещо свое',
  lede:
    'Понякога най-хубавите вечери не са пред екрана, а с чаша в ръце, която сам си направил. Два часа с глина, без бързане и без опит.',
  ctaPrimary: 'Виж свободните дати',
  ctaSecondary: 'Как протича',
  scroll: 'Разгледай',
  /**
   * Two finished pieces stand over the hero at different depths. They are the
   * first thing that says what you leave with, and the reason the section is
   * never quite still.
   */
  piece: {
    src: '/media/piece-chashi.webp',
    alt: 'Ръчно изработени керамични чаши върху дървена маса',
    caption: 'Направено на работилница',
  },
  piece2: {
    src: '/media/piece-chasha.webp',
    alt: 'Керамична чаша, оставена да изсъхне',
  },
  facts: [
    { k: 'Трае', v: '2 часа' },
    { k: 'Цена', v: '31 €' },
    { k: 'Опит', v: 'не е нужен' },
  ],
};

export const manifesto = {
  eyebrow: 'Какво е това',
  text:
    'Глината не иска талант. Иска ръце, малко време и някой, който да ти покаже как се държи. Каквото излезе от твоите ръце, ще е твое — леко накриво, с отпечатък от пръст отстрани, и точно затова ще ти е любимата чаша.',
  footnote:
    'Работилниците са за хора, които не са пипали глина от училище. Никой не идва подготвен — това е идеята.',
};

export const process = {
  eyebrow: 'Как протича',
  title: 'Как минават двата часа',
  lede: 'Никой не бърза. Ето докъде се стига и кога.',
  /** `at` is the clock reading from the start — the section is a timeline. */
  steps: [
    {
      at: '0:00',
      title: 'Сядаш и се запознаваме',
      text:
        'Наливам по чаша лимонада и показвам глината — каква е на пипане и какво ще правим с нея. Пет минути, колкото да се отпуснем.',
      image: '/media/workshop/glina-na-masata.webp',
      alt: 'Ръце месят глина върху дървена дъска',
    },
    {
      at: '0:20',
      title: 'Оформяш',
      text:
        'Показвам захвата, после е твое. Мачкаш, изтъняваш, вдигаш стените. Глината прощава — ако не стане, започваш отначало със същата буца.',
      image: '/media/workshop/oformyane.webp',
      alt: 'Ръце оформят глина',
    },
    {
      at: '1:00',
      title: 'Украсяваш',
      text:
        'Печати, шарки, инициали, листо от двора. Тук всяка чаша става различна от съседната.',
      image: '/media/workshop/risuvane.webp',
      alt: 'Ръка рисува върху керамична чаша',
    },
    {
      at: '1:50',
      title: 'Оставяш я при мен',
      text:
        'Глината трябва да изсъхне и да мине два пъти през пещта. Пиша ти, щом чашата е готова, и си я вземаш оттук.',
      image: '/media/workshop/gotovi-za-pech.webp',
      alt: 'Изсъхнали керамични чаши, подредени преди изпичане',
    },
  ],
};

export const included = {
  eyebrow: 'Какво е включено',
  title: 'Не носиш нищо',
  lede:
    'Цената покрива всичко — включително двете минавания през пещта, които стават след работилницата.',
  /** Each row swaps the picture beside it — hover on desktop, scroll on a phone. */
  items: [
    {
      title: 'Глина',
      text: 'Колкото ти трябва. Сгрешиш ли, започваш пак със същата буца.',
      image: '/media/workshop/inc-glina.webp',
    },
    {
      title: 'Глеч и цветове',
      text: 'Избираш цвета, аз се грижа за останалото.',
      image: '/media/workshop/inc-cvetove.webp',
    },
    {
      title: 'Инструменти и престилка',
      text: 'Всичко е на масата, преди да дойдеш.',
      image: '/media/workshop/inc-instrumenti.webp',
    },
    {
      title: 'Чаша лимонада',
      text: 'Домашна. Плюс нещо леко за хапване.',
      image: '/media/workshop/inc-limonada.webp',
    },
    {
      title: 'Изпичане и глазиране',
      text: 'Двете печения след това са включени в цената.',
      image: '/media/workshop/inc-prestilka.webp',
    },
    {
      title: 'Помощ през цялото време',
      text: 'Показвам, обяснявам и оправям, ако се обърка.',
      image: '/media/workshop/inc-pomosht.webp',
    },
  ],
};

export const gallery = {
  eyebrow: 'От работилницата',
  title: 'Какво излиза от два часа',
  lede: 'Всяка от тях е направена от човек, който сяда пред глина за пръв път.',
  /**
   * Three rows, standing on shelves. `span` is out of 12 columns and the
   * three spans in a row must add up to 12; tops align to the shelf and the
   * bottoms stay ragged, the way pieces actually stand.
   */
  rows: [
    [
      { src: '/media/gallery/chinii-i-chashi.webp', w: 1300, h: 867, span: 5,
        alt: 'Ръчно изработени чинии и чаши, подредени на купчина',
        caption: 'Чинии и чаши от една вечер' },
      { src: '/media/gallery/chasha-cvetna.webp', w: 1300, h: 1950, span: 3,
        alt: 'Керамична чаша с цветна шарка',
        caption: 'Шарката я измисля този, който я прави' },
      { src: '/media/gallery/chashi-raft.webp', w: 1300, h: 867, span: 4,
        alt: 'Керамични чаши на дървен рафт',
        caption: 'Рафтът в ателието, преди да си ги приберат' },
    ],
    [
      { src: '/media/gallery/sini-chashi.webp', w: 1300, h: 867, span: 4,
        alt: 'Сини керамични чаши с ръчна шарка',
        caption: 'Една глеч, четири различни чаши' },
      { src: '/media/gallery/chasha-risuvana.webp', w: 1300, h: 1733, span: 3,
        alt: 'Ръчно рисувана керамична чаша',
        caption: 'Рисувана на ръка, след първото печене' },
      { src: '/media/gallery/chashi-darven-raft.webp', w: 1300, h: 867, span: 5,
        alt: 'Керамични чаши, подредени на рафт',
        caption: 'Чакат втората пещ' },
    ],
    [
      { src: '/media/gallery/sin-servis.webp', w: 1300, h: 867, span: 5,
        alt: 'Син керамичен сервиз на рафт',
        caption: 'Като се хванеш, спираш трудно' },
      { src: '/media/gallery/chashi-tabla.webp', w: 1300, h: 867, span: 4,
        alt: 'Керамични чаши върху табла',
        caption: 'Готови за прибиране' },
      { src: '/media/gallery/chasha-cherna.webp', w: 1300, h: 1950, span: 3,
        alt: 'Тъмна керамична чаша',
        caption: 'Матова глеч — любимата на повечето' },
    ],
  ],
};

/** TODO: заменѝ с истински отзиви от участници. */
export const testimonials = {
  eyebrow: 'Отзиви',
  title: 'Какво казват след това',
  items: [
    {
      quote:
        'Отидох, защото приятелка ме довлече. Сега пия кафето си всяка сутрин от чаша, която сама съм направила.',
      name: 'Мария',
      detail: 'беше на „Глина и лимонада“',
    },
    {
      quote:
        'Мислех, че ще е като час по труд и ще се излагам. Оказа се, че просто мачкаш глина и си говориш с хора.',
      name: 'Ивелина',
      detail: 'беше на ботаническата чиния',
    },
    {
      quote:
        'Заведох жена си за годишнината вместо на ресторант. Определено по-добра идея.',
      name: 'Красимир',
      detail: 'беше на „Направи своя керамична чаша“',
    },
  ],
};

export const faq = {
  eyebrow: 'Въпроси',
  title: 'Преди да се запишеш',
  helpTitle: 'Не намери отговора си?',
  helpText: 'Пиши ми — отговарям бързо и на най-дребния въпрос.',
  items: [
    {
      q: 'Кога си получавам чашата?',
      a: 'Не същата вечер. Глината трябва да изсъхне и да мине два пъти през пещта — веднъж преди глечта и веднъж след нея. Пиша ти, щом е готова, и си я вземаш от ателието. Изпичането е включено в цената.',
    },
    {
      q: 'Трябва ли да мога нещо?',
      a: 'Не. Почти никой, който идва, не е пипал глина преди. Показвам захвата, а нататък ръцете сами разбират.',
    },
    {
      q: 'Как става плащането?',
      a: 'Записваш се тук, а плащаш на място в деня на работилницата — в брой или с карта. Няма нужда да превеждаш нищо предварително.',
    },
    {
      q: 'Мога ли да дойда без компания?',
      a: 'Разбира се — половината хора идват точно така. Масата е обща и до края на вечерта вече си с компания.',
    },
    {
      q: 'Има ли възрастово ограничение?',
      a: 'Деца под 12 години идват с възрастен. За останалото — ако можеш да седиш на маса два часа, можеш и да работиш с глина.',
    },
    {
      q: 'Какво да облека?',
      a: 'Нещо, което няма да ти е жал да изцапаш. Глината се чисти лесно, но пак. Престилки има на място.',
    },
    {
      q: 'Ако се запиша и не мога да дойда?',
      a: 'Пиши ми или се откажи от връзката в имейла за потвърждение. Мястото ти отива на някой от чакащите, а ти идваш на следващата.',
    },
    {
      q: 'Може ли да си направим частна работилница?',
      a: 'Може — за рожден ден, моминско парти или тиймбилдинг. Пиши ми колко сте и кога, и ще измислим нещо.',
    },
  ],
};

export const privateEvents = {
  title: 'Частни и фирмени работилници',
  text:
    'Рожден ден, моминско парти, тиймбилдинг или подарък за екипа. От 6 до 25 души, в ателието или при вас, в ден по ваш избор — идвам с глината и всичко останало.',
  cta: 'Изпрати запитване',
};

export const legal = {
  studioName: 'Alesse Studio',
  studioUrl: 'https://alessestudio.com',
};
