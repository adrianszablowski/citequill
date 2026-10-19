# Google structured data fact table (fetched 2026-10-19 from developers.google.com)

Every property name below was read from the live Google Search Central page named in each section, on 19 October 2026. Nothing is from memory. Where a page states "there are no required properties" that is reported as such. Where a nested type has no table of its own on Google's page, that is said explicitly rather than filled in from schema.org.

Site-wide rules (from https://developers.google.com/search/docs/appearance/structured-data/sd-policies, last updated 2026-07-10):
- "Don't mark up content that is not visible to readers of the page."
- "Your structured data must be a true representation of the page content."
- "For example, if the JSON-LD markup describes a performer, the HTML body must describe that same performer."
- "Don't mark up irrelevant or misleading content, such as fake reviews or content unrelated to the focus of a page."
- "Items that are missing required properties are not eligible for rich results."
- "The more recommended properties that you provide, the higher quality the result is to users."
- "Put the structured data on the page that it describes, unless specified otherwise by the documentation."
- "Try to use the most specific applicable type and property names defined by schema.org for your markup."
- "All image URLs specified in structured data must be crawlable and indexable."
- "A structured data manual action means that a page loses eligibility for appearance as a rich result; it doesn't affect how the page ranks in Google web search."

A recurring image rule, worded identically on Article, Event, LocalBusiness, Recipe, Profile page, Merchant listing and Carousels (beta): "minimum of 50K pixels when multiplying width and height", "with the following aspect ratios: 16x9, 4x3, and 1x1", "Image URLs must be crawlable and indexable", "Images must represent the marked up content", "Images must be in a file format that's supported by Google Images."

Field order in every section: name and URL; @types; required; recommended; numeric and format rules; visible-content statement; notes.

---

## 1. Article
URL: https://developers.google.com/search/docs/appearance/structured-data/article

@types: "Article objects must be based on one of the following schema.org types:" Article, NewsArticle, BlogPosting. Author must be Person or Organization; "Don't use the Thing type."

Required: none. The page says twice: "There are no required properties; instead, add the properties that apply to your content."

Recommended (7): author, author.name, author.url, dateModified, datePublished, headline, image

Numeric and format rules:
- image: "minimum of 50K pixels when multiplying width and height"; aspect ratios "16x9, 4x3, and 1x1"; "providing multiple high-resolution images"; "Use images that are relevant to the article, rather than logos or captions."
- datePublished, dateModified: ISO 8601; "We recommend that you provide timezone information; otherwise, we will default to the timezone used by Googlebot."
- headline: "Consider using a concise title, as long titles may be truncated on some devices."
- author: "When specifying multiple authors, list each author in their own author field"; "Don't merge multiple authors in the same author field"; "In the author.name property, only specify the name of the author."
- author.url: "A link to a web page that uniquely identifies the author of the article." "If the URL is an internal profile page, we recommend marking up that author using profile page structured data."

Visible-content statement: "Make sure that all the authors that are presented as authors on the web page are also included in markup." "Images must represent the marked up content."

Notes: Technical guidelines cover rel=canonical on multi-part articles and point to the paywalled content guide; no AMP/non-AMP distinction remains.

---

## 2. Breadcrumb
URL: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb

@types: BreadcrumbList, ListItem. Value types named: Thing, URL, Text, Integer.

Required:
- BreadcrumbList: itemListElement
- ListItem (the "Required properties" subheading is followed by three rows, in this order): item, name, position

Recommended: none. The page has no "Recommended properties" heading.

Numeric and format rules:
- "To specify breadcrumbs, define a BreadcrumbList that contains at least two ListItems."
- "Position 1 signifies the beginning of the trail."
- Conditional exemptions, quoted: "If the breadcrumb is the last item in the breadcrumb trail, item is not required." "If item isn't included for the last item, Google uses the URL of the containing page." "If you're using a Thing with a name instead of a URL to specify item, then name is not required."
- "you can specify multiple breadcrumb trails for a single page."

Visible-content statement: none on the page. Closest: "We recommend providing breadcrumbs that represent a typical user path to a page, instead of mirroring the URL structure."

Notes: Changelog January 22, 2025: breadcrumbs "only appear on desktop search results, not mobile."

---

## 3. Carousel
URL: https://developers.google.com/search/docs/appearance/structured-data/carousel

@types: ItemList, ListItem. Supported carousel content types: Course (course list), Movie, Recipe, Restaurant.

Required:
- ItemList: itemListElement
- ListItem, summary page layout (two rows): position, url
- ListItem, all-in-one page layout: item, with the sub-rows item.name, item.url and "Any other properties required for this data type". position is also listed in the all-in-one ListItem section; one read placed it under no Required/Recommended label and a targeted read counted only one row (item) under Required. Report as: item required, position present on the page without a label in that layout.

Recommended: none listed.

Numeric and format rules:
- "To specify a list, define an ItemList that contains at least two ListItem elements."
- "Check that itemListElement contains two or more ListItem elements."
- position: "This is a 1-based number."

Visible-content statement: "The text visible to the user must be similar to the information contained in the structured data on the page."

---

## 4. Course list
URL: https://developers.google.com/search/docs/appearance/structured-data/course

@types: Course, ItemList (with ListItem). provider is an Organization. CourseInstance is not mentioned on this page.

Required:
- Course: description, name
- ItemList: itemListElement
- ListItem: ListItem.position, ListItem.url

Recommended:
- Course: provider

Numeric and format rules:
- "You must mark up at least three courses."
- description: "Display limit of 60 characters."
- ListItem.url: "Every item must have a unique URL."

Visible-content statement: none on the page.

Notes: The separate "Course info" feature was deprecated (see deprecations); this page does not mention it.

---

## 5. Dataset
URL: https://developers.google.com/search/docs/appearance/structured-data/dataset (last updated 2026-09-08)

@types: Dataset, DataCatalog, DataDownload. creator/funder: Person (sameAs ORCID) or Organization (sameAs ROR).

Required:
- Dataset: description, name
- DataDownload: distribution.contentUrl

Recommended:
- Dataset (16): alternateName, creator, citation, funder, hasPart or isPartOf, identifier, isAccessibleForFree, keywords, license, measurementTechnique, sameAs, spatialCoverage, temporalCoverage, variableMeasured, version, url
- DataCatalog: includedInDataCatalog
- DataDownload: distribution, distribution.encodingFormat

Numeric and format rules:
- description: "The summary must be between 50 and 5000 characters long."
- "We recommend limiting all textual properties to 5000 characters or less."
- "Google Dataset Search only uses the first 5000 characters of any textual property."

Visible-content statement: none on the page.

Notes: The page is live in the gallery with no deprecation banner. The changelog entry of November 5, 2025 says Google is "phasing out the practice problem and dataset structured data types from Google Search results" and "Clarified that Dataset structured data is only used by Dataset Search". An audit tool should treat Dataset as a Dataset Search feature, not a Google Search rich result.

---

## 6. Discussion forum
URL: https://developers.google.com/search/docs/appearance/structured-data/discussion-forum

@types: DiscussionForumPosting, or SocialMediaPosting ("If your site is more like a generic social media platform, you can use SocialMediaPosting"); Comment; InteractionCounter; author Person or Organization. "Only use DiscussionForumPosting markup to describe a user-generated post on a website." "If the structure of the forum website is primarily questions with answers, we recommend that you use" QAPage.

Required:
- DiscussionForumPosting: author, author.name, datePublished, "Either text or image or video"
- Comment: author, datePublished, "Either text or image or video"
- InteractionCounter: userInteractionCount, interactionType

Recommended:
- DiscussionForumPosting (14): author.url, comment, commentCount, creativeWorkStatus, dateModified, digitalSourceType, headline, image, interactionStatistic, isPartOf, sharedContent, text, url, video
- Comment (11): author.url, comment, commentCount, creativeWorkStatus, dateModified, digitalSourceType, image, interactionStatistic, sharedContent, url, video
- InteractionCounter: none

Numeric and format rules: dates ISO 8601; userInteractionCount and commentCount are Integer. interactionType action subtypes named: LikeAction, DislikeAction, ViewAction, CommentAction, ReplyAction, WriteAction, ShareAction.

Visible-content statement: none containing "visible". Closest: "Make sure each DiscussionForumPosting includes the entire text of the post". mainEntity: "If the URL is primarily about a single post, use mainEntity (or mainEntityOfPage)"; "Don't mark one post on the page as a main entity if it's not a discussion page for the post".

Notes: Person/Organization author properties are not tabulated here; the page refers to the Article and Profile page docs.

---

## 7. Education Q&A
URL: https://developers.google.com/search/docs/appearance/structured-data/education-qa

@types: Quiz, Question (eduQuestionType set to Flashcard), Answer (as acceptedAnswer), Thing (as about), AlignmentObject (as educationalAlignment).

Required:
- Quiz: hasPart
- Question: acceptedAnswer, eduQuestionType, text

Recommended:
- Quiz: about, about.name, educationalAlignment, educationalAlignment.alignmentType, educationalAlignment.targetName
- Question: none

Numeric and format rules:
- "There must only be one acceptedAnswer property per Question type."
- "Use one hasPart property to represent a single flashcard."
- "There must be at least one question and answer pairing on your page"

Visible-content statement: "The questions on your site should be immediately visible to users on the page".

---

## 8. Employer aggregate rating
URL: https://developers.google.com/search/docs/appearance/structured-data/employer-rating

@types: EmployerAggregateRating; itemReviewed is an Organization (examples show @type, name, sameAs; no Organization table).

Required: itemReviewed, ratingCount, ratingValue, reviewCount. "At least one of ratingCount or reviewCount is required."

Recommended: bestRating, worstRating

Numeric and format rules:
- "The default scale for numbers is a 5-point scale, where 1 is the lowest value and 5 is the highest value."
- "If bestRating is omitted, 5 is assumed." "If worstRating is omitted, 1 is assumed."
- ratingValue accepts "a number, fraction, or percentage (for example, "4", "60%", or "6 / 10")."

Visible-content statement: "Make sure that the ratings are available to users from the page where you add EmployerAggregateRating structured data."

---

## 9. Event
URL: https://developers.google.com/search/docs/appearance/structured-data/event

@types: Event; location is Place with PostalAddress; offers Offer; organizer Organization or Person; performer Person or PerformingGroup; eventStatus values EventCancelled, EventPostponed, EventRescheduled, EventScheduled.

Required (4): location, location.address, name, startDate

Recommended (17): description, endDate, eventStatus, image, location.name, offers, offers.availability, offers.price, offers.priceCurrency, offers.validFrom, offers.url, organizer, organizer.name, organizer.url, performer, performer.name, previousStartDate

Numeric and format rules:
- image: "We recommend that images are 1920px wide (the minimum width is 720px)."; "minimum of 50K pixels when multiplying width and height"; "16x9, 4x3, and 1x1".
- offers.price: "If the event is available without payment, fees, or service charges, set the price to 0."
- offers.priceCurrency: "The 3-letter ISO 4217 currency code."
- offers.availability values: InStock, SoldOut, PreOrder.
- Dates: "Specify the timezone by including the UTC or GMT time offset."; "you can use 2019-08-15 as both the startDate and endDate for a day-long event."

Visible-content statement: none containing "visible". "Each event must accurately describe the event name, start date, and location." "Images must represent the marked up content."

Notes: The words eventAttendanceMode and VirtualLocation do not appear on the page. "Virtual experiences that have no real-world component aren't supported." Changelog June 5, 2025: "Also removed the online event properties." An audit tool should not require or recommend eventAttendanceMode or VirtualLocation.

---

## 10. Image metadata
URL: https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata (last updated 2025-12-10)

@types: ImageObject; creator is Person or Organization.

Required: contentUrl; and "Either creator or creditText or copyrightNotice or license".

Recommended: acquireLicensePage, creator, creator.name, creditText, copyrightNotice, license

Numeric and format rules: none for pixels. C2PA: "The app, device, or service has adopted C2PA version 2.1 or later."

Visible-content statement: none.

Notes: IPTC photo metadata embedded in the file is an accepted alternative: "Alternatively, you can embed IPTC photo metadata directly inside an image." IPTC recommended fields: Copyright Notice, Creator, Credit Line, Digital Source Type, Licensor URL, Web Statement of Rights.

---

## 11. Job posting
URL: https://developers.google.com/search/docs/appearance/structured-data/job-posting

@types: JobPosting; hiringOrganization Organization; jobLocation Place with PostalAddress; baseSalary MonetaryAmount with QuantitativeValue; applicantLocationRequirements AdministrativeArea (examples use Country, State); identifier PropertyValue; educationRequirements EducationalOccupationalCredential; experienceRequirements OccupationalExperienceRequirements.

Required (5): datePosted, description, hiringOrganization, jobLocation, title

Recommended (7): applicantLocationRequirements, baseSalary, directApply, employmentType, identifier, jobLocationType, validThrough

Recommended (beta) (5): educationRequirements, educationRequirements.credentialCategory, experienceRequirements, experienceRequirements.monthsOfExperience, experienceInPlaceOfEducation

Nested properties mentioned in prose or examples only (no separate table): hiringOrganization name, sameAs, logo; address streetAddress, addressLocality, addressRegion, postalCode, addressCountry ("Note that you must include the addressCountry property." "Include as many properties as possible."); baseSalary currency, value with value/minValue/maxValue/unitText; identifier name, value.

Numeric and format rules:
- validThrough: "The date when the job posting will expire in ISO 8601 format." "This is required for job postings that have an expiration date." "If a job posting never expires, or you do not know when the job will expire, do not include this property."
- Expired: "We don't allow expired job postings." To remove: "Ensure the validThrough property is populated and in the past." "Failure to take timely action on expired jobs may result in a manual action."
- datePosted: "The original date that employer posted the job in ISO 8601 format"
- description: "You must format the description in HTML."
- baseSalary: "Only employers can provide baseSalary."; unitText "use one of the following case-sensitive values:" HOUR, DAY, WEEK, MONTH, YEAR; "To specify a salary range, define a minValue and a maxValue, rather than a single value."
- employmentType: "Choose one or more of the following case-sensitive values:" (CONTRACTOR is quoted; the page lists the full set); "You can include more than one employmentType property."
- Remote: "The jobLocationType property is required if the job is 100% remote." "Jobs marked as TELECOMMUTE must be fully remote." "The jobLocation property isn't required if applicantLocationRequirements is present." applicantLocationRequirements: "This property is required if applicants may be located in one or more geographic locations and the job is 100% remote." "At least one country is required." "You must specify a minimum of one country from which applicants are eligible to work". Legacy: "Google continues to support TELECOMMUTE as an additionalProperty of jobLocation."
- Logo: "For JobPosting structured data, the image width and height ratio must be between 0.75 and 2.5."
- experienceRequirements.monthsOfExperience: "The minimum number of months of experience that are required for the job posting."

Visible-content statement: "all information in the markup must be visible on the job page." Also: "A page includes content that doesn't match the structured data on the page." (listed as a cause of a manual action).

---

## 12. Local business
URL: https://developers.google.com/search/docs/appearance/structured-data/local-business (last updated 2026-09-08)

@types: LocalBusiness and subtypes; "Use the most specific LocalBusiness sub-type possible". Subtypes named on the page: Restaurant, DaySpa, HealthClub, Store, Pharmacy (department example), Electrician, Plumber, Locksmith (multi-type array example). Nested: PostalAddress, GeoCoordinates, OpeningHoursSpecification, Review, AggregateRating. The Organization page is recommended for administrative details.

Required (2): address, name. The string "@id" does not appear anywhere on the page. image is not in the LocalBusiness list.

Recommended (17): aggregateRating, department, geo, geo.latitude, geo.longitude, menu, openingHoursSpecification, openingHoursSpecification.closes, openingHoursSpecification.dayOfWeek, openingHoursSpecification.opens, openingHoursSpecification.validFrom, openingHoursSpecification.validThrough, priceRange, review, servesCuisine, telephone, url

Restaurant carousel (limited access), separate table: Required image, name; Recommended address, servesCuisine.

Numeric and format rules:
- priceRange: "This field must be shorter than 100 characters." "If it's 100 characters or longer, Google won't show a price range for the business."
- geo: "The precision must be at least 5 decimal places."
- opens/closes: "in hh:mm:ss format"; all-day: opens "00:00" and closes "23:59"; validFrom/validThrough "in YYYY-MM-DD format"; dayOfWeek "One or more of the following values."
- image (restaurant carousel): 50K pixels and 16x9, 4x3, 1x1 rule.
- aggregateRating and review: "This property is only recommended for sites that capture reviews about other local businesses"; "Follow the Review snippet guidelines and the list of required and recommended" properties.
- department: "Include the store name with the department name in the following format: {store name} {department name}."
- url: "The URL must be a working link."

Visible-content statement: none containing "visible". "Images must represent the marked up content."

---

## 13. Math solver
URL: https://developers.google.com/search/docs/appearance/structured-data/math-solvers

@types: MathSolver, LearningResource; potentialAction is SolveMathAction with target EntryPoint.

Required:
- MathSolver: potentialAction, potentialAction.mathExpression-input, potentialAction.target, url, usageInfo
- LearningResource: learningResourceType

Recommended:
- MathSolver: inLanguage, assesses, potentialAction.eduQuestionType
- LearningResource: none

Numeric and format rules: none. The page lists problem-type values for assesses (Absolute Value Equation through Trigonometry) and says the list is not exhaustive.

Visible-content statement: none.

---

## 14. Movie
URL: https://developers.google.com/search/docs/appearance/structured-data/movie

@types: Movie inside ItemList/ListItem (carousel). director Person. review and aggregateRating point to the Review snippet page.

Required: image, name

Recommended: aggregateRating, dateCreated, director, review

Numeric and format rules: "Images must have a high resolution and have a 6:9 aspect ratio." "While Google can crop images that are close to a 6:9 aspect ratio, images largely deviating from this ratio aren't eligible for the feature." No pixel size given.

Visible-content statement: "Images must represent the marked up content."

---

## 15. Organization
URL: https://developers.google.com/search/docs/appearance/structured-data/organization (last updated 2026-09-08)

@types: Organization and subtypes. "We recommend using the most specific schema.org subtype of Organization that matches your organization." "if you have an ecommerce site, then we recommend using the OnlineStore subtype instead of OnlineBusiness." For a physical business, "the most specific subtype(s) of LocalBusiness".

Required: none. "There are no required properties."

Recommended (30, page order): address, address.addressCountry, address.addressLocality, address.addressRegion, address.postalCode, address.streetAddress, alternateName, contactPoint, contactPoint.email, contactPoint.telephone, description, duns, email, foundingDate, globalLocationNumber, hasMerchantReturnPolicy, hasMemberProgram, hasShippingService, iso6523Code, legalName, leiCode, logo, naics, name, numberOfEmployees, sameAs, taxID, telephone, url, vatID

Numeric and format rules:
- logo: "The image must be 112x112px, at minimum." "The image URL must be crawlable and indexable." "The image file format must be supported by Google Images". "Make sure the image looks how you intend it to look on a purely white background". "If you use the ImageObject type, make sure that it has a valid contentUrl property or url property". No aspect ratio stated.
- numberOfEmployees: QuantitativeValue, examples use value or minValue/maxValue.

Visible-content statement: none.

Notes: hasMerchantReturnPolicy, hasMemberProgram, hasShippingService link to the Return policy, Loyalty program and Shipping policy pages (sections 16d to 16f).

---

## 16a. Product (overview)
URL: https://developers.google.com/search/docs/appearance/structured-data/product (last updated 2025-12-10)

Overview only; no property tables. "For product pages where people can't directly purchase the product" use product snippets; merchant listings are for "pages where customers can purchase products from you". Meeting merchant listing required properties also qualifies for product snippets. Sub-pages: product-snippet, merchant-listing, product-variants, return-policy, loyalty-program (and shipping-policy via the nav).

## 16b. Product snippet
URL: https://developers.google.com/search/docs/appearance/structured-data/product-snippet (last updated 2026-09-08)

@types: Product, Review, Offer, AggregateOffer, UnitPriceSpecification, ItemList/ListItem (pros and cons), AggregateRating, Rating; Car only when combined with Product.

Required:
- Product: name; and "Product snippets require either review or aggregateRating or offers"
- Review (Product reviews, pros and cons): two statements about the product in negativeNotes and/or positiveNotes
- ItemList for notes: itemListElement, itemListElement.name
- Offer: price or priceSpecification.price
- UnitPriceSpecification: price
- AggregateOffer: lowPrice, priceCurrency

Recommended:
- Product: aggregateRating, offers, review
- Review: negativeNotes, positiveNotes
- ItemList: itemListElement.position
- Offer: availability, priceCurrency or priceSpecification.priceCurrency, priceValidUntil
- UnitPriceSpecification: priceCurrency
- AggregateOffer: highPrice, offerCount

Numeric and format rules:
- Price 0 allowed: "Here's an example of how to specify that a product is available without payment:" (example uses "price": 0).
- priceCurrency: three-letter ISO 4217.
- "Your product snippet may not display if the priceValidUntil property indicates a past date."
- AggregateOffer allowed: "An AggregateOffer is a kind of Offer representing an aggregation of other offers." "Don't use AggregateOffer to describe a set of product variants."
- lowPrice: "Use a decimal separator (.) when expressing fractions of a currency unit".
- "If you add a review for the product, the reviewer's name must be a valid name for a Person or Team."
- No image size rule on this page.

Visible-content statement: none on this page; no self-serving rule on this page (that rule lives on Review snippet).

## 16c. Merchant listing
URL: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (last updated 2026-09-08; 127,023 characters, read in full across two offsets)

@types: Product, Offer, UnitPriceSpecification, QuantitativeValue, SizeSpecification, 3DModel, PeopleAudience, Certification, OfferShippingDetails, ShippingDeliveryTime, DefinedRegion, MerchantReturnPolicy, ProductGroup, Review, AggregateRating, EnergyConsumptionDetails. "Only pages where a shopper can purchase a product are eligible for merchant listing experiences".

Required:
- Product (3): name, image, offers
- 3DModel: encoding, encoding.contentUrl
- Offer, as the page's "Required properties" heading lists them (3 rows): price or priceSpecification.price; priceCurrency or priceSpecification.priceCurrency; priceSpecification. The priceSpecification row's description reads: "The active price can also be specified using price and priceCurrency inside a priceSpecification property." and "The priceSpecification property allows the specification of complex prices by using UnitPriceSpecification objects." Note for the caller: the row sits under Required on the page (confirmed three times), but its description reads as an alternative container rather than a mandatory object. Also: "priceCurrency is required if price is specified".
- UnitPriceSpecification: price, priceCurrency
- QuantitativeValue (unit pricing): unitCode, value
- Certification: issuedBy, name
- OfferShippingDetails: deliveryTime, shippingDestination, shippingRate, shippingRate.currency, shippingRate.value or shippingRate.maxValue
- QuantitativeValue (shipping times): maxValue, minValue, unitCode
- DefinedRegion: addressCountry
- MerchantReturnPolicy: applicableCountry, returnPolicyCategory

Recommended:
- Product (18): aggregateRating, audience, brand.name, category, color, description, gtin | gtin8 | gtin12 | gtin13 | gtin14 | isbn, hasAdultConsideration, hasCertification, inProductGroupWithID, isVariantOf, material, mpn, pattern, review, size, sku, subjectOf
- Offer (8): availability, hasMerchantReturnPolicy, itemCondition, priceValidUntil, shippingDetails, url, validFrom, validThrough
- UnitPriceSpecification (6): membershipPointsEarned, priceType, referenceQuantity, validForMemberTier, validFrom, validThrough
- QuantitativeValue (unit pricing): valueReference
- SizeSpecification (3): name, sizeGroup, sizeSystem
- PeopleAudience (3): suggestedGender, suggestedMaxAge (or suggestedAge.maxValue), suggestedMinAge (or suggestedAge.minValue)
- Certification: certificationIdentification, certificationRating
- ShippingDeliveryTime: handlingTime, transitTime
- DefinedRegion: addressRegion or postalCode ("Choose either addressRegion or postalCode"; "Do not provide both a region and postal code information.")
- MerchantReturnPolicy (4): merchantReturnDays, returnFees, returnMethod, returnShippingFeesAmount

Numeric and format rules:
- "Unlike product snippets, merchant listing experiences require a price greater than zero."
- "Product snippets accept an Offer or AggregateOffer but merchant listings require an Offer" (AggregateOffer is not accepted for merchant listings).
- image: "The URL of a product photo. Pictures clearly showing the product (for example, against a white background) are preferred."; 50K pixels; 16x9, 4x3, 1x1; crawlable; Google Images formats.
- availability values (full URLs; "The short names without the URL prefix are also supported"): BackOrder, Discontinued, InStock, InStoreOnly, LimitedAvailability, OnlineOnly, OutOfStock, PreOrder, PreSale, SoldOut.
- itemCondition values: NewCondition, RefurbishedCondition, UsedCondition.
- priceType: "You must set the priceType to the https://schema.org/StrikethroughPrice value (no other values are supported)."
- hasAdultConsideration: "Google Search only supports the value https://schema.org/SexualContentConsideration for this property."
- hasCertification: "Up to 10 certifications can be specified." "The ratingValue property is required when the certificationRating property is used."
- SizeSpecification: "At most two size groups can be provided."
- PeopleAudience ages: suggestedMaxAge 0.25, 1.0, 5.0, 13.0; suggestedMinAge 0, 0.25, 1.0, 5.0, 13.0.
- Shipping: "At least one of shippingRate.value or shippingRate.maxValue must be specified." "To specify free shipping, set the value to 0." Handling/transit: "The value must be a non-negative, whole number."; unitCode DAY or d.
- Return: "You can specify up to 50 countries." "If you use MerchantReturnFiniteReturnWindow, the merchantReturnDays property is required." returnPolicyCategory values: MerchantReturnFiniteReturnWindow, MerchantReturnNotPermitted, MerchantReturnUnlimitedWindow.
- inProductGroupWithID, sku and others: "Specify at most one value."

Visible-content statement: none containing "visible" or "match" on this page.

## 16d. Product variants
URL: https://developers.google.com/search/docs/appearance/structured-data/product-variants

@types: ProductGroup with hasVariant Product.
Required: ProductGroup: name
Recommended: aggregateRating, brand, brand.name, description, hasAdultConsideration, hasVariant, productGroupID, review, url (single-page sites only), variesBy
Rules: variesBy values https://schema.org/color, size, suggestedAge, suggestedGender, material, pattern. productGroupID on the group or inProductGroupWithID on variants; if both, they must match. Variant Product properties come from the merchant listing / product snippet pages.

## 16e. Merchant return policy
URL: https://developers.google.com/search/docs/appearance/structured-data/return-policy

@types: MerchantReturnPolicy (under Organization.hasMerchantReturnPolicy; offer-level override allowed with a smaller set), MerchantReturnPolicySeasonalOverride.
Required, "choose the option that best suits your use case": Option A applicableCountry, returnPolicyCategory; Option B merchantReturnLink.
Recommended: merchantReturnDays, returnFees, returnMethod, returnShippingFeesAmount, customerRemorseReturnFees, customerRemorseReturnLabelSource, customerRemorseReturnShippingFeesAmount, itemCondition, itemDefectReturnFees, itemDefectReturnLabelSource, itemDefectReturnShippingFeesAmount, refundType, restockingFee, returnLabelSource, returnPolicyCountry, returnPolicySeasonalOverride (required inside it: returnPolicyCategory; recommended: endDate, merchantReturnDays, startDate).
Rules: applicableCountry and returnPolicyCountry "You can specify up to 50 countries."; merchantReturnDays required only when returnPolicyCategory is MerchantReturnFiniteReturnWindow; returnShippingFeesAmount "must be specified only when" returnFees is ReturnShippingFees, and must be non-zero. refundType: ExchangeRefund, FullRefund, StoreCreditRefund. returnFees: FreeReturn, ReturnFeesCustomerResponsibility, ReturnShippingFees. returnMethod: ReturnAtKiosk, ReturnByMail, ReturnInStore.

## 16f. Loyalty program
URL: https://developers.google.com/search/docs/appearance/structured-data/loyalty-program

@types: MemberProgram (under Organization.hasMemberProgram), MemberProgramTier.
Required: MemberProgram: name, description, hasTiers. MemberProgramTier: name, hasTierBenefit.
Recommended: MemberProgram: url. MemberProgramTier: hasTierRequirement, url, and membershipPointsEarned (listed after the Recommended label; "Also specify membershipPointsEarned" when hasTierBenefit is TierBenefitLoyaltyPoints).
Rules: "A loyalty program must have at least one tier." hasTierBenefit values https://schema.org/TierBenefitLoyaltyPoints, https://schema.org/TierBenefitLoyaltyPrice. hasTierRequirement: "CreditCard, or MonetaryAmount, or UnitPriceSpecification, or Text".

## 16g. Merchant shipping policy (from the left nav, not the gallery grid)
URL: https://developers.google.com/search/docs/appearance/structured-data/shipping-policy

@types: ShippingService under Organization.hasShippingService; does not replace Offer.shippingDetails (product-level override outranks organization-level; Merchant Center/Search Console settings outrank both).
Required: ShippingService: shippingConditions. DefinedRegion: addressCountry. MonetaryAmount (order value): currency, maxValue, minValue (text says either minValue or maxValue must be provided). MonetaryAmount (shipping rate): currency, and maxValue or value, not both.
Recommended: ShippingService: name, description, fulfillmentType, handlingTime, validForMemberTier. ServicePeriod (handling): businessDays, cutoffTime, duration. ServicePeriod (transit): businessDays, duration. QuantitativeValue (handling/transit): maxValue, minValue, unitCode, value (rule: value or maxValue, with unitCode). ShippingConditions: doesNotShip, numItems, orderValue, shippingDestination, shippingOrigin, seasonalOverride, shippingRate, transitTime, weight. DefinedRegion: addressRegion, postalCode. QuantitativeValue (weight, numItems): maxValue, minValue, unitCode (minValue or maxValue must be provided). ShippingRateSettings: orderPercentage or weightPercentage. OpeningHoursSpecification (seasonal override): validFrom, validThrough (at least one).
Rules: "The value must be a non-negative, whole number."; unitCode "DAY or d"; weight "LBR (pound) or KGM (kilogram)"; percentages "Use a value between 0 and 1."; "For free shipping, use 0 as the value."; "For orders processed after cutoff time, one day gets added to the delivery time estimate."; fulfillmentType FulfillmentTypeDelivery (default) or FulfillmentTypeCollectionPoint.

---

## 17. Profile page
URL: https://developers.google.com/search/docs/appearance/structured-data/profile-page

@types: ProfilePage with mainEntity Person or Organization (default to Person when unknown); InteractionCounter.

Required:
- ProfilePage: mainEntity
- Person or Organization: name. "If the name property isn't available, you can provide the alternateName property to fulfill this requirement."

Recommended:
- ProfilePage: dateCreated, dateModified
- Person or Organization: agentInteractionStatistic, alternateName, description, identifier, image, interactionStatistic, sameAs

Numeric and format rules: image 50K pixels and 16x9, 4x3, 1x1; dates ISO 8601; agentInteractionStatistic types FollowAction, LikeAction, WriteAction, ShareAction; interactionStatistic types FollowAction, LikeAction, BefriendAction.

Visible-content statement: "Only include stats about the platform that the profile page is hosted on." "Images must represent the marked up content."

---

## 18. Q&A
URL: https://developers.google.com/search/docs/appearance/structured-data/qapage

@types: QAPage, Question, Answer, Comment.

Required:
- QAPage: mainEntity
- Question: answerCount; "Either acceptedAnswer or suggestedAnswer"; name
- Answer: text
- Comment: text

Recommended:
- Question (11): author, author.url, comment, commentCount, dateModified, datePublished, digitalSourceType, image, text, upvoteCount, video
- Answer (11): author, author.url, comment, commentCount, dateModified, datePublished, digitalSourceType, image, upvoteCount, url, video
- Comment (9): author, author.url, comment, commentCount, dateModified, datePublished, digitalSourceType, image, video

Numeric and format rules:
- "There must only be one QAPage type definition per page." "There must only be one Question type definition per page."
- "To be eligible for the rich result, a question must have at least one answer – either an acceptedAnswer or a suggestedAnswer."
- "answerCount + commentCount should equal the total number of replies of any type." "For questions without answers, set the answerCount property to 0."
- acceptedAnswer and suggestedAnswer: "There can be zero or more of these per question."

Visible-content statement: none.

---

## 19. Recipe
URL: https://developers.google.com/search/docs/appearance/structured-data/recipe

@types: Recipe; recipeInstructions as HowToStep, HowToSection, HowToDirection, HowToTip; ItemList/ListItem for carousel; video is VideoObject (with Clip) per the Video page.

Required:
- Recipe (2): image, name
- HowToSection: itemListElement, name
- HowToStep: itemListElement ("Optional if text is used"), text ("Optional if itemListElement is used")
- HowToDirection and HowToTip: text
- ItemList: itemListElement, ListItem.position, ListItem.url

Recommended:
- Recipe (15): aggregateRating, author, cookTime, datePublished, description, keywords, nutrition.calories, prepTime, recipeCategory, recipeCuisine, recipeIngredient, recipeInstructions, recipeYield, totalTime, video
- HowToStep: image, name, url, video

Numeric and format rules:
- image: 50K pixels; 16x9, 4x3, 1x1; HowToStep images "must be in .jpg, .png, or. gif format."
- Times ISO 8601. "Use totalTime or a combination of both cookTime and prepTime." cookTime: "Always use in combination with prepTime." prepTime: "Always use in combination with cookTime." Changelog January 18, 2022: "the only supported method is an exact time; time ranges aren't supported."
- recipeYield: "Specify the number of servings produced from this recipe with just a number." "This is required if you specify any nutritional information per serving (such as nutrition.calories)."
- recipeInstructions: "We recommend using HowToStep." "Repeated property values are concatenated into a single block of text."

Visible-content statement: "Images must represent the marked up content."

---

## 20. Review snippet
URL: https://developers.google.com/search/docs/appearance/structured-data/review-snippet

@types: Review, AggregateRating, Rating; author Person or Organization. "Google also supports reviews for the following schema.org types (and their subtypes):" Book, Course, CreativeWorkSeason, CreativeWorkSeries, Episode, Event, Game, HowTo, LocalBusiness, MediaObject, Movie, MusicPlaylist, MusicRecording, Organization, Product, Recipe, SoftwareApplication.

Required:
- Review: author; itemReviewed (if not a nested review); itemReviewed.name or the parent item's name when nested; reviewRating; reviewRating.ratingValue
- AggregateRating: itemReviewed (if not nested); itemReviewed.name or parent name when nested; ratingCount; reviewCount ("At least one of ratingCount or reviewCount is required."); ratingValue

Recommended:
- Review: datePublished, reviewRating.bestRating, reviewRating.worstRating
- AggregateRating: bestRating, worstRating

Numeric and format rules:
- "The default scale for numbers is a 5-point scale, where 1 is the lowest value and 5 is the highest value." "If bestRating is omitted, 5 is assumed." "If worstRating is omitted, 1 is assumed."
- "For decimal numbers, use a dot instead of a comma to specify the value (for example 4.4 instead of 4,4)."
- Nested: "If the review is nested into another schema.org type using the review property, omit the itemReviewed property (we assume the parent item is the reviewed item)."

Self-serving rule, verbatim: "If the entity that's being reviewed controls the reviews about itself, their pages that use LocalBusiness or any other type of Organization structured data are ineligible for star review feature. For example, a review about entity A is placed on the website of entity A, either directly in their structured data or through an embedded third-party widget (for example, Google Business reviews or Facebook reviews widget)." Applies to LocalBusiness and any Organization type (and subtypes). Also: "Ratings must be sourced directly from users." "Don't rely on human editors to create, curate, or compile ratings information for local businesses."

Visible-content statement: "Make sure the review content you mark up are readily available to users from the marked-up page."

Notes: Changelog July 24, 2026 "Added a new guideline to the review snippet documentation about fake and undisclosed incentivized reviews" (text not captured; not a property rule).

---

## 21. Software app
URL: https://developers.google.com/search/docs/appearance/structured-data/software-app

@types: SoftwareApplication, MobileApplication, WebApplication; VideoGame only as a co-type, not alone (changelog October 13, 2021: VideoGame "is not a valid node type for" Software Apps).

Required: name; offers.price; "aggregateRating or review"

Recommended: applicationCategory, operatingSystem

Numeric and format rules:
- "If the app is available without payment, set offers.price to 0."
- "If the app has a price greater than 0, we recommend also including the offers.priceCurrency property."
- applicationCategory "must be a supported app type": GameApplication, SocialNetworkingApplication, TravelApplication, ShoppingApplication, SportsApplication, LifestyleApplication, BusinessApplication, DesignApplication, DeveloperApplication, DriverApplication, EducationalApplication, HealthApplication, FinanceApplication, SecurityApplication, BrowserApplication, CommunicationApplication, DesktopEnhancementApplication, EntertainmentApplication, MultimediaApplication, HomeApplication, UtilitiesApplication, ReferenceApplication.

Visible-content statement: none.

---

## 22. Speakable
URL: https://developers.google.com/search/docs/appearance/structured-data/speakable

@types: speakable property on Article or WebPage, value SpeakableSpecification. "This feature is in beta and subject to change." US and English only.

Required: cssSelector, xPath (page spells it xPath). "Use either cssSelector or xPath; don't use both."

Recommended: none.

Numeric and format rules: "around 20-30 seconds of content per section of speakable structured data, or roughly two to three sentences."; "returns up to three articles from around the web".

Visible-content statement: none.

---

## 23. Subscription and paywalled content
URL: https://developers.google.com/search/docs/appearance/structured-data/paywalled-content

@types: CreativeWork and these subtypes: Article, NewsArticle, Blog, Comment, Course, HowTo, Message, Review, WebPage. hasPart is WebPageElement. Multiple types may be combined, for example ["Article", "LearningResource"].

Required: isAccessibleForFree

Recommended: hasPart.cssSelector, hasPart.@type, hasPart.isAccessibleForFree

Numeric and format rules: none.

Visible-content statement: markup that does not match "can result in content mismatch errors that appear in Search Console."

---

## 24. Vacation rental
URL: https://developers.google.com/search/docs/appearance/structured-data/vacation-rental

@types: VacationRental; containsPlace Accommodation; occupancy and floorSize QuantitativeValue; bed BedDetails; amenityFeature LocationFeatureSpecification; address PostalAddress; brand Brand; aggregateRating, review per Review snippet page. Eligibility: sites that have "already connected with a Google Technical Account Manager" with Hotel Center access; interest form "doesn't guarantee invitation".

Required (8): containsPlace, containsPlace.occupancy, containsPlace.occupancy.value, identifier, image, latitude or geo.latitude, longitude or geo.longitude, name

Recommended: additionalType, address (addressCountry, addressLocality, addressRegion, postalCode, streetAddress), aggregateRating, brand, checkinTime, checkoutTime, containsPlace.additionalType, containsPlace.amenityFeature, containsPlace.bed (numberOfBeds, typeOfBed), containsPlace.floorSize, containsPlace.numberOfBathroomsTotal, containsPlace.numberOfBedrooms, containsPlace.numberOfRooms, description, knowsLanguage, review (review.contentReferenceTime). Conditional: review.datePublished is required for vacation rentals; review.contentReferenceTime is required for listings in France.

Numeric and format rules: "The listing must have a minimum of 8 photos"; latitude/longitude "Precision must be at least 5 decimal places."; floorSize units FTK or SQFT, MTK or SQM; bathrooms sum full and half baths (2 full + 1 half = 2.5). amenityFeature boolean names: ac, airportShuttle, balcony, beachAccess, childFriendly, crib, elevator, fireplace, freeBreakfast, gymFitnessEquipment, heating, hotTub, instantBookable, ironingBoard, kitchen, microwave, outdoorGrill, ovenStove, patio, petsAllowed, pool, privateBeachAccess, selfCheckinCheckout, smokingAllowed, tv, washerDryer, wheelchairAccessible, wifi; non-boolean: internetType, parkingType, poolType, licenseNum. No pixel sizes on the page.

Visible-content statement: none.

---

## 25. Video
URL: https://developers.google.com/search/docs/appearance/structured-data/video

@types: VideoObject, BroadcastEvent (publication), Clip (hasPart), SeekToAction (potentialAction); creator/author Person or Organization; interactionStatistic InteractionCounter with WatchAction.

Required:
- VideoObject (3): name, thumbnailUrl, uploadDate
- BroadcastEvent: publication, publication.endDate, publication.isLiveBroadcast, publication.startDate
- Clip: name, startOffset, url
- SeekToAction: potentialAction, potentialAction.startOffset-input, potentialAction.target

Recommended:
- VideoObject (15): contentUrl, creator (or author), creator.name (or author.name), creator.url (or author.url), description, duration, embedUrl, expires, hasPart, ineligibleRegion, interactionStatistic, interactionStatistic.interactionType, interactionStatistic.userInteractionCount, publication, regionsAllowed
- Clip: endOffset

One-of groups: creator or author (creator added September 24, 2026, "noting support for author"); contentUrl or embedUrl ("We recommend that your provide the contentUrl property, if possible." "If contentUrl isn't available, provide embedUrl as an alternative." "Don't link to the page where the video lives; this must be the URL of the video file's actual content bytes itself."); ineligibleRegion or regionsAllowed; creator.name or alternateName.

Numeric and format rules:
- uploadDate, duration, expires: ISO 8601; "Don't supply this information if your video does not expire."
- "The total video duration must be a minimum of 30 seconds."
- Clips: "Make sure that no two clips on the same video defined on the same page share a start time."; timestamps "[hour]:[minute]:[second]".
- Thumbnail (from https://developers.google.com/search/docs/appearance/video, which the structured data page links as "thumbnail image guidelines"): "Minimum 60x30 pixels, larger preferred."; formats "BMP, GIF, JPEG, PNG, WebP, SVG, and AVIF"; "The thumbnail file must be accessible by Googlebot and Googlebot Images"; "Make sure that the file is consistently available at a stable URL."; "At least 80% of the thumbnail's pixels must have an alpha (transparency) value greater than 250." No aspect ratio.

Visible-content statement: "VideoObject structured data must be added to a page where users can watch the video." From the video best-practices page: "The video must be embedded on a watch page." "The video can't be hidden behind other elements."

Notes: Changelog April 17, 2024 removed the video carousel (limited access) guidance.

---

## 26. Structured data carousels (beta) (in the nav under "Regional differences", not the gallery grid)
URL: https://developers.google.com/search/docs/appearance/structured-data/carousels-beta (last updated 2026-09-11)

@types: ItemList with ListItem.item being LocalBusiness and subtypes (Restaurant, Hotel, VacationRental, LodgingBusiness), Product, or Event. Regions: EEA, Türkiye, South Africa, with per-region verticals.

Required: ItemList: itemListElement. ListItem: itemListElement.item, itemListElement.position. Each item (LocalBusiness, Product or Event): image, name, url.

Recommended: common: aggregateRating.bestRating, aggregateRating.ratingCount, aggregateRating.ratingValue. LocalBusiness: amenityFeature (LodgingBusiness only), priceRange, servesCuisine (restaurants only). Product and Event: offers, offers.highPrice, offers.lowPrice, offers.price, offers.priceCurrency (Offer uses price and priceCurrency; AggregateOffer uses highPrice, lowPrice and priceCurrency).

Rules: "define an ItemList that contains at least three itemListElement.item elements."; position 1-based; image 50K pixels and 16x9, 4x3, 1x1; priceRange "This field must be shorter than 12 characters."; "If bestRating is omitted, 5 is assumed."; price 0 allowed for events; "Google defaults to USD."

Visible-content statement: "Images must represent the marked up content."

---

## 27. Book actions (in the nav, not the gallery grid)
URL: https://developers.google.com/search/docs/appearance/structured-data/book (last updated 2025-12-10)

Status: live, no deprecation notice. "this feature is currently limited to book providers with a wide selection of available books." Submitted as a JSON feed to Google, not page markup. Changelog: June 12, 2025 banner added; November 5, 2025 "Removed the deprecation banner from Book actions documentation".
@types: DataFeed, Book (Work and Edition), ReadAction, BorrowAction, LibrarySystem, Library, Person/Organization author, PropertyValue identifier.
Required: DataFeed: @context, @type, dataFeedElement. Book (Work): @context, @id, @type, author, name, url, workExample. Book (Edition): @id, @type, bookFormat, inLanguage, isbn, potentialAction. author: @type, name. identifier: @type, propertyID, value. ReadAction: @type, expectsAcceptanceOf, expectsAcceptanceOf.@type, expectsAcceptanceOf.category, expectsAcceptanceOf.eligibleRegion, expectsAcceptanceOf.eligibleRegion.@type, expectsAcceptanceOf.eligibleRegion.name, target, target.@type, target.actionPlatform, target.urlTemplate. BorrowAction: @type, lender, lender.@id, lender.@type, target, target.@type, target.actionPlatform, target.urlTemplate. LibrarySystem: @context, @id, @type, additionalProperty, additionalProperty.@type, additionalProperty.name, additionalProperty.value, member, name, url. Library: @id, @type, location, location.@type, location.addressCountry, location.addressLocality, location.addressRegion, location.postalCode, location.streetAddress, name.
Recommended: Work: sameAs. Edition: author, bookEdition, datePublished, identifier, name, sameAs, url. author: sameAs. ReadAction: expectsAcceptanceOf.availabilityEnds, expectsAcceptanceOf.availabilityStarts, expectsAcceptanceOf.price, expectsAcceptanceOf.priceCurrency.
Rules: "There must be at least one workExample for each Work."; price "required when the Offer property's category is set to purchase or rental."; feed "must be less than 1 GB"; ".json filename extension".

---

## 28. Fact check (in the nav, not the gallery grid)
URL: https://developers.google.com/search/docs/appearance/structured-data/factcheck (last updated 2026-09-08)

Status: live with notice: "We're phasing out support for ClaimReview markup in Google Search." "However, this markup remains supported by the Factcheck Explorer Tool." No date on the notice; changelog June 12, 2025 added the banner.
@types: ClaimReview, Claim, Rating.
Required: ClaimReview: claimReviewed, reviewRating, url. Rating: alternateName.
Recommended: ClaimReview: author, itemReviewed. Claim: appearance, author, datePublished, firstAppearance ("We recommend that you add either appearance or firstAppearance."). Rating: bestRating, name, ratingValue, worstRating. author: name or url (at least one).
Rules: "a page must only have one ClaimReview element."; ratingValue "in the range worstRating — bestRating inclusive."; bestRating "Must be greater than worstRating."; worstRating "Must have a minimum value of 1."

---

## (a) Deprecated, removed or restricted features (source: https://developers.google.com/search/updates, read in full, 179,036 characters, plus the live pages named)

Where Google's current text does not name the schema.org @type, that is stated rather than filled in.

- FAQ rich result. May 8, 2026: "This feature will no longer appear in Google Search starting May 7, 2026." June 15, 2026: documentation removed; "The FAQ rich result feature is no longer shown in Google Search results." Earlier restriction September 14, 2023: "the feature is only shown for well-known, authoritative government and health websites." @type not named in Google's current text; former slug /structured-data/faqpage.
- Practice problem. November 5, 2025 deprecation notice added; January 6, 2026 documentation removed: "The practice problem structured data type is no longer shown in Google Search results." @type not named; former slug /structured-data/practice-problems.
- Dataset. November 5, 2025: "phasing out the practice problem and dataset structured data types from Google Search results"; "Clarified that Dataset structured data is only used by Dataset Search". @type Dataset. Page remains live with no banner.
- Course info, estimated salary, learning video, special announcement, vehicle listing. June 12, 2025 banners added; September 9, 2025 documentation removed: "These structured data types are no longer shown in Google Search results." Special announcement had its own notice April 23, 2025: "This feature will be deprecated starting July 31, 2025." @types not named in current text (SpecialAnnouncement is named only in the October 28, 2021 unused-fields entry). Former slugs: /course-info, /estimated-salary, /learning-video, /special-announcements, /vehicle-listing.
- Fact check (ClaimReview). June 12, 2025 banner; live page says "We're phasing out support for ClaimReview markup in Google Search." @type ClaimReview. Still supported by Fact Check Explorer.
- Book actions. June 12, 2025 banner added; November 5, 2025 banner removed. Not deprecated; page live.
- Event online event properties. June 5, 2025: "Also removed the online event properties." eventAttendanceMode and VirtualLocation no longer appear on the Event page (property-level removal, not a feature removal).
- Video carousel (limited access). April 17, 2024: guidance removed from the Video page. @type not named.
- Home activity. June 11, 2024: "Removed documentation on home activity structured data." "The home activity feature no longer appears in Google Search results." @type not named; former slug /home-activities.
- Sitelinks search box. November 29, 2024: "The sitelinks search box feature is no longer available in Google Search results." @type not named; former slug /sitelinks-searchbox.
- Guided recipes (Google Assistant). March 6, 2024: Recipe docs updated after the Assistant feature was removed.
- How-to. September 14, 2023: "Removed the How-to structured data documentation, as this rich result is no longer shown in search results, on both desktop and mobile devices." @type named only as "How-to" in the entry; HowTo is named in the October 28, 2021 unused-fields entry. Former slug /how-to.
- Breadcrumb restriction. January 22, 2025: breadcrumbs "only appear on desktop search results, not mobile."
- Job training. May 31, 2022: "Removed the Job training structured data documentation." @type not named.
- Critic review. June 10, 2021: "Deprecated the critic review documentation." @type not named.
- VideoGame as a Software app node type. October 13, 2021: VideoGame "is not a valid node type for" Software Apps (allowed only as a co-type).
- Unused fields removed. October 28, 2021: fields removed from HowTo, QAPage, SpecialAnnouncement documentation "since they are unused by Google Search".
- data-vocabulary.org. October 30, 2020: "data-vocabulary.org markup will no longer be eligible for Google rich result features."
- Social Profile, Corporate Contact, Place Actions structured data. May 11, 2020: "Removed the following documentation that has been deprecated since June 2019"; social profile and corporate contact discovery is now automatic; place actions replaced by the Maps Booking API. @types not named.
- Not structured data types, listed in the changelog as removed: Page Annotations (March 7, 2025), AI while browsing (March 27, 2025), Follow in Discover (November 19, 2025), Notes (August 9, 2024), cache: operator (September 24, 2024), cached link (October 2, 2024), related: operator (July 18, 2023), Web Light (December 19, 2022), Duplex on the web (December 1, 2022), Mobile Friendly Test (December 1, 2023), Structured Data Testing Tool redirect (August 9, 2021).

## (b) Redirects observed

These former feature URLs did not 404. Each returned the /search/updates changelog content, meaning Google same-host-redirects them there: /structured-data/faqpage, /how-to, /practice-problems, /course-info, /estimated-salary, /learning-video, /special-announcements, /vehicle-listing, /home-activities, /sitelinks-searchbox.

## (c) Pages that could not be fetched

None. All 25 gallery pages, the Product sub-pages (product-snippet, merchant-listing, product-variants, return-policy, loyalty-program, shipping-policy), carousels-beta, book, factcheck, sd-policies, the video best-practices page and the full updates changelog were fetched. The merchant-listing and updates pages exceeded one read and were read to the end with offsets.

Caveats on method: WebFetch summarises through a small model that caps quotes at about 125 characters, so long descriptions are paraphrased; property names and the Required/Recommended placement were cross-checked with a second names-only pass on Article, Breadcrumb, Carousel, Organization, Product snippet, Merchant listing, LocalBusiness, Event, JobPosting, Recipe, Video and Discussion forum, and the two passes agreed except for the Carousel all-in-one ListItem position row noted in section 3.