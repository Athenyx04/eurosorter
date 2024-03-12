import type { Artist, Country } from '../lib/data.ts'

interface Props {
  position: number
  artist: Artist
  country: Country
  gridColumn?: string
}

function ShareCard({
  position,
  artist,
  country,
  gridColumn = 'span 1 / span 1'
}: Props) {
  return (
    <div
      className={`flex min-w-0 select-none ${
        position === 1
          ? 'col-span-2 bg-yellow-200 text-black'
          : position === 2
            ? 'border-t-2 border-platinum bg-gray-400'
            : position === 3
              ? 'border-t-2 border-platinum bg-orange-900'
              : 'border-t-2 border-liberty bg-eerie'
      }`}
      style={{ gridColumn }}
    >
      <div className={`relative w-1/5 shrink-0`}>
        <img
          className='absolute left-0 top-0 size-full object-cover'
          src={artist.imageUrl}
          alt={artist.name}
        />
        <div className='pb-[100%}'></div>
      </div>
      <div className='flex size-8 shrink-0 -translate-x-4 items-center justify-center self-center rounded-full bg-liberty'>
        <span className='font-bold text-slate-200'>
          {String(position).padStart(2, '0')}
        </span>
      </div>
      <div className='flex min-w-0 flex-row items-center py-3'>
        <div className='flex min-w-0 flex-col'>
          <div className='flex items-center gap-2 font-bold'>
            <span
              className={
                `fi fi-${country.code.toLowerCase()} ` + 'size-6 rounded-full'
              }
            />
            <span className='truncate'>{country.name.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShareCard
