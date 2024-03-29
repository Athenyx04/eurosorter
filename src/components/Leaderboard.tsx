import html2canvas from 'html2canvas'
import { useEffect, useState } from 'react'
import { useTranslations } from 'src/i18n/utils'

import {
  type AgeGroup,
  type EntryDetails,
  type RankingResponse
} from '../lib/data'
import { $ } from '../lib/dom-selector'
import { useFilterStore } from '../store/filterStore'
import ShareContainer from './ShareContainer'
import ShareDialog from './ShareDialog'
import { type OptionType } from './ui/multiSelect'
import LeaderboardSongList from './LeaderboardSongList'
import LeaderboardHeader from './LeaderboardHeader'

const Load = () => (
  <svg
    role='img'
    aria-hidden='true'
    width='48'
    viewBox='0 0 24 24'
    strokeWidth='2'
    stroke='#e5e5e5'
    fill='none'
    className='animate-spin'
  >
    <path stroke='none' d='M0 0h24v24H0z' fill='none' />
    <path d='M12 3a9 9 0 1 0 9 9' />
  </svg>
)

function Leaderboard({ songList }: { songList: EntryDetails[] }) {
  const hasHydrated = useFilterStore((state) => state._hasHydrated)

  const [shareImage, setShareImage] = useState<HTMLCanvasElement | null>(null)
  const [songs, setSongs] = useState<EntryDetails[]>([])
  const [filteredSongs, setFilteredSongs] = useState<EntryDetails[]>([])
  const [viewGroup, setViewGroup] = useState<string>('')
  const [entryValues, setEntryValues] = useState<OptionType[]>([])
  const [rankingTitle, setRankingTitle] = useState<string>(
    'Eurovision 2024 Leaderboard'
  )
  const [scoringFunction, setScoringFunction] = useState<'linear' | 'esc'>(
    'linear'
  )
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('')
  const [country, setCountry] = useState<string>('ZZ')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [fetchedPositions, setFetchedPositions] = useState<number[][]>([])
  const { filteredEntries, setFilteredEntries } = useFilterStore((state) => ({
    filteredEntries: state.filteredEntries,
    setFilteredEntries: state.setFilteredEntries
  }))
  const t = useTranslations('en')

  function handleSelectRanking(ranking: string) {
    triggerScreenshot(ranking)
  }

  async function triggerScreenshot(elementId: string) {
    const element = $('#' + elementId)

    if (!element) {
      console.error('Element not found:', elementId)
      return
    }

    const scale = 2
    const canvas = document.createElement('canvas')
    const logging = false
    canvas.width = element.offsetWidth * scale
    canvas.height = element.offsetHeight * scale

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('Canvas context not found')
      return
    }

    const originalDrawImage = ctx.drawImage

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.drawImage = function (...args: any[]) {
      const image = args[0]
      let sx
      let sy
      let sw
      let sh
      let dx
      let dy
      let dw
      let dh

      if (args.length === 3) {
        [dx, dy] = args.slice(1)
      } else if (args.length === 5) {
        [dx, dy, dw, dh] = args.slice(1)
      } else if (args.length === 9) {
        [sx, sy, sw, sh, dx, dy, dw, dh] = args.slice(1)
      }

      if (image instanceof HTMLImageElement && args.length === 9) {
        if (sw / dw < sh / dh) {
          const originalDh = dh
          dh = sh * (dw / sw)
          dy += (originalDh - dh) / 2
        } else {
          const originalDw = dw
          dw = sw * (dh / sh)
          dx += (originalDw - dw) / 2
        }
      }

      if (args.length === 9) {
        originalDrawImage.call(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh)
      }
    }

    const finalCanvas = await html2canvas(element, {
      canvas,
      scale,
      logging,
      useCORS: true
    })
    setShareImage(finalCanvas)
  }

  useEffect(() => {
    async function getAllPositions() {
      const url = new URL('/api/allRankings.json', window.location.href)
      url.searchParams.append('editionId', '1')
      if (country !== 'ZZ') {
        url.searchParams.append('nationality', country)
      }
      if (ageGroup !== '') {
        url.searchParams.append('ageGroup', ageGroup)
      }
      const response = await fetch(url)
      if (!response.ok) {
        setIsLoading(false)
        return
      }
      const data = await response.json()
      const result = data.result as RankingResponse[]
      const allPositions = result.map((result) =>
        result.positions.split(',').map(Number)
      )
      setFetchedPositions(allPositions)
    }

    if (hasHydrated) {
      setIsLoading(true)
      getAllPositions()
    }
  }, [hasHydrated, country, ageGroup])

  useEffect(() => {
    const optionEntries = songList.map((entry) => ({
      // @ts-expect-error - ${entry.country} is a database country code
      label: t(`country.${entry.country}`),
      value: entry.id.toString()
    }))
    setEntryValues(optionEntries)
  }, [songList])

  useEffect(() => {
    if (!fetchedPositions.length) {
      setFilteredSongs([])
      setIsLoading(false)
      return
    }

    // Step 1: Initialize points for each song based on the songList
    const points: Record<number, number> = songList.reduce(
      (acc, song) => {
        acc[song.id] = 0
        return acc
      },
      {} as Record<number, number>
    )

    // Determine the total number of unique songs
    const totalSongs = songList.length
    const scoresESC = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1]

    // Step 2: Assign points based on user rankings
    // Songs not ranked get 0 points implicitly and are already initialized

    if (scoringFunction === 'esc') {
      // ESC scoring system
      fetchedPositions.forEach((ranking) => {
        ranking.forEach((songId, index) => {
          if (index >= scoresESC.length) {
            return
          }
          points[songId] += scoresESC[index]
        })
      })
    } else if (scoringFunction === 'linear') {
      // Linear decay function
      fetchedPositions.forEach((ranking) => {
        ranking.forEach((songId, index) => {
          points[songId] += Math.round(totalSongs - index)
        })
      })
    }

    // Step 3: Aggregate and sort the points
    const sortedEntries = Object.entries(points)
      .map(([songId, score]: [string, number]) => ({
        score,
        // Include additional info from songList if needed
        ...songList.find((song) => song.id === parseInt(songId))
      }))
      .sort((a, b) => b.score - a.score) as EntryDetails[]

    setSongs(sortedEntries)
    setFilteredSongs(sortedEntries)
    setIsLoading(false)
  }, [scoringFunction, fetchedPositions])

  useEffect(() => {
    if (songs && filteredEntries) {
      const group =
        viewGroup === 'big5'
          ? 'Big 5 + Host'
          : viewGroup === 'semiOne'
            ? 'Semifinal 1'
            : viewGroup === 'semiTwo'
              ? 'Semifinal 2'
              : viewGroup === 'nordics'
                ? 'Nordics'
                : viewGroup === 'baltics'
                  ? 'Baltics'
                  : viewGroup === 'balkans'
                    ? 'Balkans'
                    : null

      let filteredSongs = songs.filter(
        (song) => !filteredEntries.includes(song.id.toString())
      )

      if (group) {
        filteredSongs = filteredSongs.filter((song) =>
          song.categories.includes(group)
        )
        setRankingTitle(`${group} 2024 Leaderboard`)
      } else {
        setRankingTitle('Eurovision 2024 Leaderboard')
      }

      setFilteredSongs(filteredSongs)
    }
  }, [viewGroup, filteredEntries])

  if (!hasHydrated || !songList) {
    return (
      <div className='flex grow items-center justify-center'>
        <Load />
      </div>
    )
  }

  return (
    <div className='flex w-full flex-col'>
      <LeaderboardHeader
        title={rankingTitle}
        viewGroup={viewGroup}
        entryValues={entryValues}
        filteredEntries={filteredEntries}
        scoringFunction={scoringFunction}
        ageGroup={ageGroup}
        country={country}
        rankingCount={fetchedPositions.length}
        setFilteredEntries={setFilteredEntries}
        setViewGroup={setViewGroup}
        setScoringFunction={setScoringFunction}
        setAgeGroup={setAgeGroup}
        setCountry={setCountry}
        handleSelectRanking={handleSelectRanking}
      />
      {isLoading && (
        <div className='flex grow items-center justify-center'>
          <Load />
        </div>
      )}
      {!filteredSongs.length && !isLoading && (
        <div className='flex flex-col gap-4 w-full grow items-center justify-center text-slate-200'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='80'
            height='80'
            viewBox='0 0 24 24'
            fill='currentColor'
          >
            <path stroke='none' d='M0 0h24v24H0z' fill='none' />
            <path d='M12 2c5.523 0 10 4.477 10 10a10 10 0 0 1 -19.995 .324l-.005 -.324l.004 -.28c.148 -5.393 4.566 -9.72 9.996 -9.72zm0 9h-1l-.117 .007a1 1 0 0 0 0 1.986l.117 .007v3l.007 .117a1 1 0 0 0 .876 .876l.117 .007h1l.117 -.007a1 1 0 0 0 .876 -.876l.007 -.117l-.007 -.117a1 1 0 0 0 -.764 -.857l-.112 -.02l-.117 -.006v-3l-.007 -.117a1 1 0 0 0 -.876 -.876l-.117 -.007zm.01 -3l-.127 .007a1 1 0 0 0 0 1.986l.117 .007l.127 -.007a1 1 0 0 0 0 -1.986l-.117 -.007z' />
          </svg>
          <p>There are no rankings with the selected filters</p>
        </div>
      )}
      {filteredSongs.length !== 0 && !isLoading && (
        <>
          <LeaderboardSongList songs={filteredSongs} />
          <ShareContainer
            id='shareAll'
            songs={filteredSongs}
            title={rankingTitle}
          />
          <ShareContainer
            id='share10'
            songs={filteredSongs.slice(0, 10)}
            title={`${rankingTitle} Top 10`}
          />
          <ShareDialog shareImage={shareImage} setShareImage={setShareImage} />
        </>
      )}
    </div>
  )
}

export default Leaderboard
