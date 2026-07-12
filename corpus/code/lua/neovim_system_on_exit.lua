local function _on_exit(state, code, signal, on_exit)
  close_handle(state.handle)
  close_handle(state.stdin)
  close_handle(state.timer)

  -- #30846: Do not close stdout/stderr here, as they may still have data to
  -- read. They will be closed in uv.read_start on EOF.

  local check = uv.new_check()
  check:start(function()
    for _, pipe in pairs({ state.stdin, state.stdout, state.stderr }) do
      if not pipe:is_closing() then
        return
      end
    end
    check:stop()
    check:close()

    if state.done == nil then
      state.done = true
    end

    if (code == 0 or code == 1) and state.done == 'timeout' then
      -- Unix: code == 0
      -- Windows: code == 1
      code = 124
    end

    local stdout_data = state.stdout_data
    local stderr_data = state.stderr_data

    state.result = {
      code = code,
      signal = signal,
      stdout = stdout_data and table.concat(stdout_data) or nil,
      stderr = stderr_data and table.concat(stderr_data) or nil,
    }

    if on_exit then
      on_exit(state.result)
    end
  end)
end
