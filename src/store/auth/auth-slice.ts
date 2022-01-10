import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios, { AxiosResponse } from 'axios'

export interface AuthState {
  token: string | null
}

const initialState: AuthState = {
  token: null,
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(loginAction.fulfilled, (state: AuthState, action) => {
      state.token = action.payload
    })
  },
})

export const loginAction = createAsyncThunk(
  'auth/login',
  async (data: { username: string; password: string; provider: string }) => {
    try {
      const axiosResponse: AxiosResponse<string> = await axios.post(
        'http://localhost:3000/v1/auth/login',
        {
          username: data.username,
          password: data.password,
          provider: data.provider,
        }
      )
      return axiosResponse.data
    } catch {
      return null
    }
  }
)

export default authSlice.reducer
