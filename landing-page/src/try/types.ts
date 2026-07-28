/* Shared between the two transports. Both were declaring these inline, which
   meant the shell could not be shared even though its markup was identical. */

export type PhotoCard = {
  url: string
  event: string
  place: string
  year: string
  people: string[]
}

export type Line = {
  who: 'agent' | 'you'
  text: string
  photo?: PhotoCard
}
